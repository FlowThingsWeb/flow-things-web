import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getConfig } from '@/lib/config'
import {
  CONFIG_CYBER_DEFAULT,
  FACTORES_DEFAULT,
  simular,
  type ConfigCyber,
  type Factores,
  type FilaCyber,
} from '@/lib/cyber-precios'

/**
 * Los precios de la promo: leerlos, aplicarlos y deshacerlos.
 *
 * Tres reglas que no se negocian, y están acá y no en la pantalla:
 *
 * 1. Los precios los calcula el servidor. El navegador manda qué productos y
 *    con qué porcentajes, nunca a cuánto quedan: un precio que viaja desde el
 *    navegador es un precio que se puede editar antes de salir.
 * 2. Antes de tocar un precio se guarda el original en `cyber_precios`. Una
 *    vez. Volver atrás es leer ese número, no deshacer la multiplicación —
 *    ×1,15 y ÷1,15 no vuelven al mismo peso con el redondeo a la centena.
 * 3. Lo que no llega al piso de margen no entra, salvo que se pida forzarlo a
 *    propósito. El piso se vuelve a calcular acá con el costo del CRM; que la
 *    pantalla lo haya mostrado en verde no alcanza.
 */

export const maxDuration = 60

type CostoCrm = { sku: string; costo_con_iva: number }

/**
 * El costo de reposición de cada SKU, pedido al CRM.
 *
 * Es el mismo endpoint que usa el ajuste automático de precios, y el costo
 * sale de la lista vigente del proveedor cuando hay una. Si el CRM no
 * contesta, esto devuelve vacío y toda la pantalla queda sin costo: sin
 * costo no se puede decir qué margen deja un descuento, así que la pantalla
 * no deja aplicar nada. Es preferible no poder hacer la promo a hacerla a
 * ciegas.
 */
async function traerCostos(): Promise<{ costos: Map<string, number>; error: string | null }> {
  const url = process.env.CRM_URL
  const secreto = process.env.CRM_SECRET
  if (!url) return { costos: new Map(), error: 'Falta la variable CRM_URL' }
  if (!secreto) return { costos: new Map(), error: 'Falta la variable CRM_SECRET' }

  try {
    const r = await fetch(`${url}/api/integraciones/costos-por-sku`, {
      headers: { Authorization: `Bearer ${secreto}` },
      cache: 'no-store',
    })
    if (r.status === 401) {
      return { costos: new Map(), error: 'El CRM rechazó la credencial (CRM_SECRET)' }
    }
    if (!r.ok) {
      const detalle = await r.text().catch(() => '')
      return { costos: new Map(), error: `El CRM respondió ${r.status}: ${detalle.slice(0, 200)}` }
    }
    const data = await r.json()
    const costos = new Map<string, number>()
    for (const c of (data.resultados ?? []) as CostoCrm[]) {
      if (c.sku && Number(c.costo_con_iva) > 0) costos.set(c.sku, Number(c.costo_con_iva))
    }
    return { costos, error: null }
  } catch (e) {
    return { costos: new Map(), error: e instanceof Error ? e.message : 'Error al hablar con el CRM' }
  }
}

async function configCyber(): Promise<ConfigCyber> {
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
function factoresDe(body: Record<string, unknown>): Factores {
  const n = (v: unknown, def: number, min: number, max: number) => {
    const x = Number(v)
    return Number.isFinite(x) && x >= min && x <= max ? x : def
  }
  return {
    inflar: n(body.inflar, FACTORES_DEFAULT.inflar, 1, 1.5),
    descuento: n(body.descuento, FACTORES_DEFAULT.descuento, 0, 0.5),
    // Por defecto se cuida: hay que pedir explícitamente dejar que un
    // producto cruce el umbral y le salga más caro al comprador.
    cuidar_envio_gratis: body.cuidar_envio_gratis !== false && body.cuidar_envio_gratis !== 'false',
  }
}

type Snapshot = {
  producto_id: string
  precio_original: number
  precio_inflado: number | null
  precio_oferta: number | null
  inflado_at: string | null
  aplicado_at: string | null
  restaurado_at: string | null
}

async function leerTodo(factores: Factores) {
  const cfg = await configCyber()
  const [{ costos, error: errorCrm }, { data: productos }, { data: snaps }] = await Promise.all([
    traerCostos(),
    supabaseAdmin
      .from('productos')
      .select('id, sku, nombre, precio, precio_anterior, stock')
      .eq('activo', true)
      .order('nombre'),
    supabaseAdmin
      .from('cyber_precios')
      .select('producto_id, precio_original, precio_inflado, precio_oferta, inflado_at, aplicado_at, restaurado_at')
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
      snap ? Number(snap.precio_original) : null,
    )
  })

  return { cfg, filas, snaps: porProducto, errorCrm }
}

export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const sp = new URL(req.url).searchParams
  const factores = factoresDe({
    inflar: sp.get('inflar'),
    descuento: sp.get('descuento'),
    cuidar_envio_gratis: sp.get('cuidar_envio_gratis') ?? true,
  })
  const { cfg, filas, snaps, errorCrm } = await leerTodo(factores)

  return NextResponse.json({
    cfg,
    factores,
    error_crm: errorCrm,
    // En qué paso está cada producto, para que la pantalla no tenga que
    // adivinarlo a partir de los precios.
    estado: {
      inflados: [...snaps.values()].filter((s) => s.inflado_at && !s.aplicado_at).length,
      aplicados: [...snaps.values()].filter((s) => s.aplicado_at).length,
    },
    filas,
  })
}

export async function POST(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const body = (await req.json()) as Record<string, unknown>
  const accion = String(body.accion ?? '')
  const forzar = body.forzar === true
  const ids = Array.isArray(body.ids) ? (body.ids as string[]).map(String) : []
  const factores = factoresDe(body)

  if (!['inflar', 'aplicar', 'restaurar'].includes(accion)) {
    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 })
  }

  const { cfg, filas, snaps } = await leerTodo(factores)
  const elegidas = filas.filter((f) => ids.includes(f.id))

  if (accion !== 'restaurar' && elegidas.length === 0) {
    return NextResponse.json({ error: 'No elegiste ningún producto' }, { status: 400 })
  }

  const hechos: { sku: string | null; de: number; a: number }[] = []
  const omitidos: { sku: string | null; motivo: string }[] = []
  const ahora = new Date().toISOString()

  if (accion === 'inflar') {
    for (const f of elegidas) {
      const snap = snaps.get(f.id)
      // Ya inflado: no se vuelve a inflar. Dos clicks seguidos al botón no
      // pueden dejar el catálogo un 32% más caro.
      if (snap?.inflado_at) {
        omitidos.push({ sku: f.sku, motivo: 'ya estaba inflado' })
        continue
      }
      await supabaseAdmin.from('cyber_precios').upsert(
        {
          producto_id: f.id,
          sku: f.sku,
          nombre: f.nombre,
          // El original es el precio de AHORA, que todavía no tocamos.
          precio_original: f.precio_actual,
          precio_inflado: f.precio_inflado,
          inflado_at: ahora,
          updated_at: ahora,
        },
        { onConflict: 'producto_id' },
      )
      await supabaseAdmin
        .from('productos')
        .update({ precio: f.precio_inflado, precio_anterior: null, updated_at: ahora })
        .eq('id', f.id)
      hechos.push({ sku: f.sku, de: f.precio_actual, a: f.precio_inflado })
    }
  }

  if (accion === 'aplicar') {
    for (const f of elegidas) {
      // Sin piso no entra. Se recalcula acá contra el costo del CRM: la
      // pantalla puede estar vieja, el costo puede haber cambiado hace diez
      // minutos, y este es el último lugar antes de que el precio salga.
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
      const snap = snaps.get(f.id)
      // Aplicar sin haber inflado es válido: es la promo de un solo paso.
      // Pero el original hay que guardarlo igual, o no hay vuelta atrás.
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
      await supabaseAdmin
        .from('cyber_precios')
        .update({ precio_oferta: f.precio_oferta, aplicado_at: ahora, updated_at: ahora })
        .eq('producto_id', f.id)
      /**
       * El tachado es el precio de lista de la promo. Si hubo paso de
       * inflado, es el inflado; si no, es el precio con el que venía.
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
  }

  if (accion === 'restaurar') {
    // Restaurar no pide lista: se vuelve TODO lo que esté tocado. Dejar la
    // mitad del catálogo con precios de promo es el peor resultado posible, y
    // es lo que pasa si hay que acordarse de tildar 161 casillas.
    const aRestaurar = [...snaps.values()].filter((s) => !s.restaurado_at)
    for (const s of aRestaurar) {
      const fila = filas.find((f) => f.id === s.producto_id)
      await supabaseAdmin
        .from('productos')
        .update({
          precio: Number(s.precio_original),
          precio_anterior: null,
          updated_at: ahora,
        })
        .eq('id', s.producto_id)
      await supabaseAdmin
        .from('cyber_precios')
        .update({ restaurado_at: ahora, updated_at: ahora })
        .eq('producto_id', s.producto_id)
      hechos.push({
        sku: fila?.sku ?? null,
        de: fila?.precio_actual ?? 0,
        a: Number(s.precio_original),
      })
    }
  }

  if (hechos.length > 0) {
    /**
     * La grilla y la home leen el catálogo cacheado por etiqueta; la ficha de
     * producto, además, se revalida cada 5 minutos por su cuenta. Durante una
     * promo esos 5 minutos son una ficha que muestra el precio viejo mientras
     * la grilla ya muestra el nuevo, así que se fuerzan las dos cosas.
     */
    revalidateTag('catalogo')
    revalidatePath('/productos/[slug]', 'page')
  }

  return NextResponse.json({
    ok: true,
    accion,
    cambiados: hechos.length,
    omitidos,
    detalle: hechos,
  })
}
