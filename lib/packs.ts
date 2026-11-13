/**
 * Packs: un producto de la tienda que por dentro son varios productos.
 *
 * Dos cosas pasan acá y en ningún otro lado:
 *
 *   1. El stock del pack, que no es un dato sino una cuenta: hay tantos
 *      packs como cajas permita armar el componente más escaso. Se recalcula
 *      cuando entra stock del CRM y cuando se edita la composición.
 *
 *   2. La apertura del pack cuando se informa la venta al CRM. El CRM no
 *      conoce los packs: todo lo que cuelga del stock —FIFO, costo de
 *      reposición, el Full de ML, los reportes— está escrito sobre
 *      productos, y un producto que "en realidad son cuatro" obligaría a
 *      revisar cada una de esas cuentas. Así que el pack se deshace de este
 *      lado y el CRM recibe los cuatro productos de siempre.
 *
 * El precio del pack se reparte entre los componentes a prorrata del precio
 * de lista que tenían cuando se armó (`items_pack.precio_lista`): cada uno
 * queda con el mismo descuento porcentual, así que el margen por producto
 * del CRM sigue siendo verdad. Repartir en partes iguales haría que el
 * cuaderno de $22.000 apareciera vendido a lo mismo que el organizador de
 * $73.300.
 */
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type ItemVentaCRM = {
  sku: string
  variante: string | null
  cantidad: number
  precio_unitario: number
}

export type ComponentePack = {
  sku: string
  cantidad: number
  precio_lista: number
}

export type PackConComponentes = {
  pack_id: string
  sku: string
  componentes: ComponentePack[]
}

const centavos = (n: number) => Math.round(n * 100) / 100

/**
 * Reparte `total` entre los pesos dados, sin perder ni inventar un centavo.
 *
 * El resto del redondeo va al componente más caro, que es donde menos se
 * nota en porcentaje. Si los pesos no suman nada —falta el precio de lista
 * de todos los componentes— se reparte en partes iguales: es peor, pero no
 * rompe.
 */
export function repartir(total: number, pesos: number[]): number[] {
  const suma = pesos.reduce((a, b) => a + b, 0)
  const base =
    suma > 0
      ? pesos.map((p) => centavos((total * p) / suma))
      : pesos.map(() => centavos(total / pesos.length))
  const resto = centavos(total - base.reduce((a, b) => a + b, 0))
  if (resto !== 0) {
    let mayor = 0
    for (let i = 1; i < base.length; i++) if (base[i] > base[mayor]) mayor = i
    base[mayor] = centavos(base[mayor] + resto)
  }
  return base
}

/** Cuántos packs se pueden armar con el stock de hoy. Manda el más escaso. */
export function packsArmables(
  componentes: { sku: string; cantidad: number }[],
  stockPorSku: Map<string, number>,
): number {
  if (componentes.length === 0) return 0
  let tope = Infinity
  for (const c of componentes) {
    const hay = stockPorSku.get(c.sku)
    // Un componente que no conocemos no se puede garantizar.
    if (hay == null) return 0
    tope = Math.min(tope, Math.floor(hay / Math.max(1, c.cantidad)))
  }
  return Math.max(0, tope === Infinity ? 0 : tope)
}

/** Todos los packs con sus componentes, resueltos a SKU. */
export async function leerPacks(): Promise<PackConComponentes[]> {
  const { data, error } = await supabaseAdmin
    .from('items_pack')
    .select(
      'pack_id, cantidad, precio_lista, pack:productos!items_pack_pack_id_fkey(sku), componente:productos!items_pack_componente_id_fkey(sku)',
    )
  if (error) {
    /**
     * 42P01 = la tabla todavía no existe. Pasa en la ventana entre deployar
     * esto y correr `supabase_packs.sql`: en ese rato no hay packs, que es
     * exactamente lo que devolver vacío significa. Cualquier otro error sí
     * explota — un pack que no se abre es una venta que descuenta el stock
     * equivocado, y eso no se traga en silencio.
     */
    if ((error as { code?: string }).code === '42P01') {
      console.warn('[packs] la tabla items_pack todavía no existe — falta correr supabase_packs.sql')
      return []
    }
    throw new Error(`items_pack: ${error.message}`)
  }

  const porPack = new Map<string, PackConComponentes>()
  for (const fila of (data ?? []) as unknown as {
    pack_id: string
    cantidad: number
    precio_lista: number
    pack: { sku: string } | null
    componente: { sku: string } | null
  }[]) {
    const skuPack = fila.pack?.sku
    const skuComp = fila.componente?.sku
    if (!skuPack || !skuComp) continue
    const actual =
      porPack.get(fila.pack_id) ??
      { pack_id: fila.pack_id, sku: skuPack, componentes: [] as ComponentePack[] }
    actual.componentes.push({
      sku: skuComp,
      cantidad: Number(fila.cantidad) || 1,
      precio_lista: Number(fila.precio_lista) || 0,
    })
    porPack.set(fila.pack_id, actual)
  }
  return [...porPack.values()]
}

/**
 * Recalcula el stock de todos los packs y lo guarda.
 *
 * Se llama después de cada push de stock del CRM y después de editar un
 * pack. Es barato —cinco packs, una consulta de stock— y hacerlo entero
 * evita el bug que aparecería al hacerlo "sólo para los SKU que se
 * movieron": un pack cuyo componente más escaso NO se movió igual cambia de
 * stock cuando se mueve otro, porque el tope lo pone el mínimo.
 *
 * Devuelve los packs cuyo stock cambió, para los logs.
 */
export async function recalcularStockPacks(): Promise<
  { sku: string; de: number; a: number }[]
> {
  const packs = await leerPacks()
  if (packs.length === 0) return []

  const skusComp = [...new Set(packs.flatMap((p) => p.componentes.map((c) => c.sku)))]
  const { data: comps, error } = await supabaseAdmin
    .from('productos')
    .select('sku, stock')
    .in('sku', skusComp)
  if (error) throw new Error(`productos (componentes): ${error.message}`)

  const stockPorSku = new Map(
    (comps ?? []).map((c) => [c.sku as string, Number(c.stock) || 0]),
  )

  const { data: filasPack } = await supabaseAdmin
    .from('productos')
    .select('id, sku, stock')
    .in(
      'id',
      packs.map((p) => p.pack_id),
    )
  const stockActual = new Map(
    (filasPack ?? []).map((p) => [p.id as string, Number(p.stock) || 0]),
  )

  const cambios: { sku: string; de: number; a: number }[] = []
  for (const pack of packs) {
    const nuevo = packsArmables(pack.componentes, stockPorSku)
    const antes = stockActual.get(pack.pack_id) ?? 0
    if (nuevo === antes) continue
    const { error: errUpd } = await supabaseAdmin
      .from('productos')
      .update({ stock: nuevo })
      .eq('id', pack.pack_id)
    if (errUpd) {
      console.error(`[packs] no se pudo guardar el stock de ${pack.sku}:`, errUpd.message)
      continue
    }
    cambios.push({ sku: pack.sku, de: antes, a: nuevo })
  }
  return cambios
}

/**
 * El costo de un pack, que tampoco es un dato: es la suma de sus partes.
 *
 * Un pack no se compra, se arma: no tiene fila en las compras del CRM ni en
 * la lista del proveedor, así que el CRM lo manda sin costo. Y "sin costo"
 * es exactamente lo que el ajuste de precios y el panel de promos leen como
 * "no sé si estoy abajo del piso de margen", que es el único freno que
 * impide publicar una oferta que pierde plata. El 2/11/2026 los cinco packs
 * quedaron afuera de las Ofertas Cyber por eso.
 *
 * Esta cuenta la hacía el CRM cuando era el dueño de la composición. Ahora
 * la composición vive acá, así que la cuenta también.
 *
 * Se emite SÓLO si todos los componentes tienen costo: con uno que falte la
 * suma da de menos, y un costo subestimado es peor que ninguno —el piso
 * pasaría dando por bueno un precio que no lo es—.
 */
export async function costosDePacks(
  costoPorSku: Map<string, number>,
): Promise<{ sku: string; costo_con_iva: number }[]> {
  const packs = await leerPacks()
  const salida: { sku: string; costo_con_iva: number }[] = []
  for (const pack of packs) {
    if (pack.componentes.length === 0) continue
    let total = 0
    let completo = true
    for (const c of pack.componentes) {
      const costo = costoPorSku.get(c.sku)
      if (costo == null || !Number.isFinite(costo) || costo <= 0) {
        completo = false
        break
      }
      total += costo * c.cantidad
    }
    if (!completo) continue
    salida.push({ sku: pack.sku, costo_con_iva: Math.round(total) })
  }
  return salida
}

export type ResultadoExpansion = {
  /** Los items ya sin packs: listos para que el CRM mapee SKU → producto. */
  items: ItemVentaCRM[]
  /** Qué packs se abrieron, para la nota de la venta. */
  packsAbiertos: { sku: string; cantidad: number }[]
  /** Cosas que no impiden informar la venta pero hay que dejar dichas. */
  avisos: string[]
}

/**
 * Deshace en componentes los items que sean packs. Los demás pasan tal cual.
 *
 * Un pack dado de baja igual se abre: si alguien lo compró, la venta existe
 * y el stock hay que descontarlo. La baja sólo evita que se venda de nuevo.
 */
export async function expandirPacks(items: ItemVentaCRM[]): Promise<ResultadoExpansion> {
  const skus = [...new Set(items.map((i) => i.sku).filter(Boolean))]
  if (skus.length === 0) return { items, packsAbiertos: [], avisos: [] }

  const packs = await leerPacks()
  const porSku = new Map(packs.map((p) => [p.sku, p]))
  if (!skus.some((s) => porSku.has(s))) {
    return { items, packsAbiertos: [], avisos: [] }
  }

  const salida: ItemVentaCRM[] = []
  const packsAbiertos: ResultadoExpansion['packsAbiertos'] = []
  const avisos: string[] = []

  for (const it of items) {
    const pack = porSku.get(it.sku)
    if (!pack || pack.componentes.length === 0) {
      /**
       * Un pack sin componentes no se puede deshacer. Pasa el SKU tal cual
       * para que el CRM lo rechace con ruido, en vez de registrar una venta
       * a la que le falta todo.
       */
      if (pack) avisos.push(`${it.sku}: el pack no tiene componentes cargados`)
      salida.push(it)
      continue
    }

    const totalLinea = (Number(it.precio_unitario) || 0) * it.cantidad
    const pesos = pack.componentes.map((c) => c.precio_lista * c.cantidad)
    const montos = repartir(totalLinea, pesos)

    pack.componentes.forEach((c, i) => {
      const unidades = it.cantidad * c.cantidad
      salida.push({
        sku: c.sku,
        variante: null,
        cantidad: unidades,
        precio_unitario: unidades > 0 ? centavos(montos[i] / unidades) : 0,
      })
    })

    packsAbiertos.push({ sku: pack.sku, cantidad: it.cantidad })
  }

  return { items: salida, packsAbiertos, avisos }
}
