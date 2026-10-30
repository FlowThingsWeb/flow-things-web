import { revalidatePath, revalidateTag } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getConfig } from '@/lib/config'
import { estadoCyber } from '@/lib/cyber'
import { guardarBorradorCyber } from '@/lib/difusion-cyber'
import {
  CONFIG_CYBER_DEFAULT,
  FACTORES_DEFAULT,
  simular,
  type ConfigCyber,
  type Factores,
  type FilaCyber,
} from '@/lib/cyber-precios'

/**
 * Leer el estado de los precios de la promo y aplicar el descuento.
 *
 * Vive en lib y no en la ruta del panel porque hay dos cosas que lo usan: el
 * botón del administrador y el cron que aplica el descuento solo cuando llega
 * la fecha. Dos caminos que escriben precios tienen que ser el MISMO código:
 * si el automático fuera una copia, el día que se corrija el piso de margen en
 * uno, el otro seguiría vendiendo abajo del piso.
 */

export const money = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

type CostoCrm = { sku: string; costo_con_iva: number; unidades_vendidas?: number }

/**
 * El costo de reposición de cada SKU, pedido al CRM.
 *
 * Es el mismo endpoint que usa el ajuste automático de precios, y el costo
 * sale de la lista vigente del proveedor cuando hay una. Si el CRM no
 * contesta, esto devuelve vacío y toda la pantalla queda sin costo: sin costo
 * no se puede decir qué margen deja un descuento, así que no se aplica nada.
 * Es preferible no hacer la promo a hacerla a ciegas.
 */
export async function traerCostos(): Promise<{
  costos: Map<string, number>
  /** Unidades vendidas por SKU en la ventana que devuelve el CRM (60 días). */
  ventas: Map<string, number>
  error: string | null
}> {
  const url = process.env.CRM_URL
  const secreto = process.env.CRM_SECRET
  const vacio = { costos: new Map<string, number>(), ventas: new Map<string, number>() }
  if (!url) return { ...vacio, error: 'Falta la variable CRM_URL' }
  if (!secreto) return { ...vacio, error: 'Falta la variable CRM_SECRET' }

  try {
    const r = await fetch(`${url}/api/integraciones/costos-por-sku`, {
      headers: { Authorization: `Bearer ${secreto}` },
      cache: 'no-store',
    })
    if (r.status === 401) {
      return { ...vacio, error: 'El CRM rechazó la credencial (CRM_SECRET)' }
    }
    if (!r.ok) {
      const detalle = await r.text().catch(() => '')
      return { ...vacio, error: `El CRM respondió ${r.status}: ${detalle.slice(0, 200)}` }
    }
    const data = await r.json()
    const costos = new Map<string, number>()
    const ventas = new Map<string, number>()
    for (const c of (data.resultados ?? []) as CostoCrm[]) {
      if (!c.sku) continue
      if (Number(c.costo_con_iva) > 0) costos.set(c.sku, Number(c.costo_con_iva))
      // Las unidades son de TODOS los canales, no sólo de la tienda: lo que se
      // vende en Mercado Libre también dice qué quiere la gente, y es donde
      // está el volumen.
      if (Number.isFinite(Number(c.unidades_vendidas))) {
        ventas.set(c.sku, Number(c.unidades_vendidas))
      }
    }
    return { costos, ventas, error: null }
  } catch (e) {
    return { ...vacio, error: e instanceof Error ? e.message : 'Error al hablar con el CRM' }
  }
}

export async function configCyber(): Promise<ConfigCyber> {
  const cfg = (await getConfig()) as Record<string, string | undefined>
  const num = (v: string | undefined, def: number) => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : def
  }
  return {
    envio: num(cfg.precio_costo_envio, CONFIG_CYBER_DEFAULT.envio),
    umbral_envio_gratis: num(
      cfg.precio_umbral_envio_gratis,
      CONFIG_CYBER_DEFAULT.umbral_envio_gratis,
    ),
    piso_margen: num(cfg.cyber_piso_margen, CONFIG_CYBER_DEFAULT.piso_margen),
  }
}

/**
 * Los porcentajes que manda la pantalla, con tope.
 *
 * El tope no desconfía del administrador, desconfía del teclado: "15" en vez
 * de "1.15" multiplica el catálogo por quince, y eso se publica en el feed de
 * Google antes de que alguien lo vea.
 */
export function factoresDe(body: Record<string, unknown>): Factores {
  const n = (v: unknown, def: number, min: number, max: number) => {
    const x = Number(v)
    return Number.isFinite(x) && x >= min && x <= max ? x : def
  }
  return {
    inflar: n(body.inflar, FACTORES_DEFAULT.inflar, 1, 1.5),
    descuento: n(body.descuento, FACTORES_DEFAULT.descuento, 0, 0.5),
    // Por defecto se cuida: hay que pedir explícitamente dejar que un producto
    // cruce el umbral y le salga más caro al comprador.
    cuidar_envio_gratis: body.cuidar_envio_gratis !== false && body.cuidar_envio_gratis !== 'false',
  }
}

export type Snapshot = {
  producto_id: string
  precio_original: number
  precio_inflado: number | null
  precio_oferta: number | null
  inflado_at: string | null
  aplicado_at: string | null
  restaurado_at: string | null
}

export async function leerTodo(factores: Factores) {
  const cfg = await configCyber()
  const [{ costos, ventas, error: errorCrm }, { data: productos }, { data: snaps }] = await Promise.all([
    traerCostos(),
    supabaseAdmin
      .from('productos')
      .select('id, sku, nombre, precio, precio_anterior, stock')
      .eq('activo', true)
      .order('nombre'),
    supabaseAdmin
      .from('cyber_precios')
      .select(
        'producto_id, precio_original, precio_inflado, precio_oferta, inflado_at, aplicado_at, restaurado_at',
      )
      .is('restaurado_at', null),
  ])

  const porProducto = new Map<string, Snapshot>()
  for (const s of (snaps ?? []) as Snapshot[]) porProducto.set(s.producto_id, s)

  const filas: FilaCyber[] = (productos ?? []).map((p) => {
    const snap = porProducto.get(p.id)
    return simular(
      {
        id: p.id,
        sku: p.sku,
        nombre: p.nombre,
        precio: Number(p.precio),
        stock: Number(p.stock ?? 0),
      },
      p.sku ? (costos.get(p.sku) ?? null) : null,
      factores,
      cfg,
      {
        precioOriginal: snap ? Number(snap.precio_original) : null,
        // El de lista que de verdad se cobró, no el que daría la cuenta de
        // nuevo: entre el paso 1 y el paso 2 el porcentaje puede haberse
        // movido en la pantalla, y el tachado tiene que ser un precio que
        // existió.
        precioInflado: snap?.precio_inflado != null ? Number(snap.precio_inflado) : null,
      },
    )
  })

  return { cfg, filas, snaps: porProducto, ventas, errorCrm }
}

export interface ResultadoAplicar {
  hechos: { sku: string | null; de: number; a: number }[]
  omitidos: { sku: string | null; motivo: string }[]
}

/**
 * Pone el precio de oferta en los productos elegidos.
 *
 * El piso de margen se vuelve a mirar ACÁ y no se confía en lo que decidió la
 * pantalla: la pantalla pudo quedar abierta media hora y el costo del
 * proveedor cambia solo. Este es el último lugar antes de que el precio salga.
 */
export async function aplicarDescuento(
  elegidas: FilaCyber[],
  snaps: Map<string, Snapshot>,
  cfg: ConfigCyber,
  forzar = false,
): Promise<ResultadoAplicar> {
  const hechos: ResultadoAplicar['hechos'] = []
  const omitidos: ResultadoAplicar['omitidos'] = []
  const ahora = new Date().toISOString()

  for (const f of elegidas) {
    if (f.bajo_piso && !forzar) {
      omitidos.push({
        sku: f.sku,
        motivo:
          f.costo == null
            ? 'sin costo en el CRM'
            : `margen ${(f.margen_oferta! * 100).toFixed(1)}% bajo el piso de ${(cfg.piso_margen * 100).toFixed(0)}%`,
      })
      continue
    }
    /**
     * Precio que no baja, tachado que sí aparece: una ficha anunciando un
     * descuento que el comprador no recibe. No se publica ni forzándolo — no
     * es una decisión comercial discutible, es un cartel falso.
     */
    if (f.sin_descuento_real) {
      omitidos.push({
        sku: f.sku,
        motivo: `el precio no baja (${money(f.precio_original)} → ${money(f.precio_oferta)}): sería un tachado sin descuento`,
      })
      continue
    }
    const snap = snaps.get(f.id)
    // Aplicar sin haber inflado es válido: es la promo de un solo paso. Pero
    // el original hay que guardarlo igual, o no hay vuelta atrás.
    if (!snap) {
      await supabaseAdmin.from('cyber_precios').insert({
        producto_id: f.id,
        sku: f.sku,
        nombre: f.nombre,
        precio_original: f.precio_actual,
        created_at: ahora,
        updated_at: ahora,
      })
    }
    // Ya aplicado: no se vuelve a aplicar. Con el automático corriendo cada
    // cinco minutos, esto es lo que evita un 20% sobre otro 20%.
    if (snap?.aplicado_at) {
      omitidos.push({ sku: f.sku, motivo: 'ya tenía el descuento aplicado' })
      continue
    }
    await supabaseAdmin
      .from('cyber_precios')
      .update({ precio_oferta: f.precio_oferta, aplicado_at: ahora, updated_at: ahora })
      .eq('producto_id', f.id)
    /**
     * El tachado es el precio de lista de la promo. Si hubo paso de inflado,
     * es el inflado; si no, es el precio con el que venía.
     */
    await supabaseAdmin
      .from('productos')
      .update({
        precio: f.precio_oferta,
        precio_anterior: snap?.inflado_at ? f.precio_inflado : f.precio_original,
        updated_at: ahora,
      })
      .eq('id', f.id)
    hechos.push({ sku: f.sku, de: f.precio_actual, a: f.precio_oferta })
  }

  return { hechos, omitidos }
}

/**
 * La grilla y la home leen el catálogo cacheado por etiqueta; la ficha de
 * producto, además, se revalida cada 5 minutos por su cuenta. Durante una
 * promo esos 5 minutos son una ficha que muestra el precio viejo mientras la
 * grilla ya muestra el nuevo, así que se fuerzan las dos cosas.
 */
export function refrescarCatalogo() {
  revalidateTag('catalogo')
  revalidatePath('/productos/[slug]', 'page')
}

const CLAVE_APLICADO = 'cyber_aplicado'

/**
 * Aplica el descuento solo, cuando llega la fecha de arranque.
 *
 * El paso 1 —subir el precio de lista— se hace a mano y días antes, porque es
 * una decisión. El paso 2 no es una decisión: es la misma lista ya revisada,
 * ejecutada a una hora en la que no hay nadie despierto. Sin esto, el lunes a
 * las 00:00 la tienda muestra la barra de la promo, la página de ofertas dice
 * que no hay ninguna y los precios están 15% más caros que la semana pasada,
 * hasta que alguien se levanta y aprieta un botón.
 *
 * Qué entra es exactamente lo que entraría apretando el botón: los que pasan
 * el piso de margen y bajan de precio de verdad. Nada se fuerza.
 *
 * Se marca antes de tocar precios pero después de leer: si algo falla a la
 * mitad, el que quedó aplicado tiene su `aplicado_at` y no se vuelve a tocar,
 * y el resto se termina a mano. Lo contrario —marcar al final— es un reintento
 * cada cinco minutos sobre un catálogo a medio aplicar, o sea un 20% sobre
 * otro 20%.
 */
export async function aplicarCyberSiCorresponde(): Promise<{
  aplicado: boolean
  motivo?: string
  cambiados?: number
  omitidos?: number
}> {
  const cfgSitio = (await getConfig()) as Record<string, string | undefined>
  const estado = estadoCyber(cfgSitio)
  if (!estado.activo) return { aplicado: false, motivo: 'la promo no está activa' }

  const marca = estado.desde ?? 'sin-fecha'
  if (cfgSitio[CLAVE_APLICADO] === marca) {
    return { aplicado: false, motivo: 'ya se aplicó' }
  }

  /**
   * Los mismos porcentajes que la pantalla, salvo que haya uno guardado.
   *
   * `cyber_descuento` se escribe en porcentaje (20 = 20%) para que se pueda
   * mirar y cambiar desde el panel sin saber que adentro es 0,2.
   */
  const pct = Number(cfgSitio.cyber_descuento)
  const factores = factoresDe({
    descuento: Number.isFinite(pct) && pct > 0 ? pct / 100 : FACTORES_DEFAULT.descuento,
  })

  /**
   * Primero leer, después marcar.
   *
   * Si el CRM no contesta no hay costos, y sin costos no se puede saber qué
   * margen deja cada descuento. En ese caso NO se marca: así vuelve a
   * intentar en la pasada siguiente, cinco minutos después, que es tiempo de
   * sobra para que un CRM dormido se despierte. Marcar acá dejaría la promo
   * prendida y sin un solo precio rebajado hasta que alguien lo notara.
   */
  const { cfg, filas, snaps, errorCrm } = await leerTodo(factores)
  if (errorCrm) return { aplicado: false, motivo: `sin costos del CRM: ${errorCrm}` }

  await supabaseAdmin
    .from('configuracion')
    .upsert({ clave: CLAVE_APLICADO, valor: marca }, { onConflict: 'clave' })
  revalidateTag('site-config')

  const { hechos, omitidos } = await aplicarDescuento(filas, snaps, cfg)
  if (hechos.length > 0) {
    refrescarCatalogo()
    /**
     * El borrador del mail se rehace con los precios recién aplicados.
     *
     * Hasta este momento el borrador mostraba la proyección —los precios que
     * iban a quedar—, que es lo que permite revisarlo con días de
     * anticipación. Ahora hay números reales, y el mail tiene que decir lo
     * mismo que la tienda. No se manda: sigue siendo un borrador.
     */
    await guardarBorradorCyber().catch((e: unknown) => {
      console.error('[cyber] no se pudo rehacer el borrador del mail:', e)
    })
  }

  return { aplicado: true, cambiados: hechos.length, omitidos: omitidos.length }
}
