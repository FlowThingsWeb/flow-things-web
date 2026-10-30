import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  aplicarDescuento,
  factoresDe,
  leerTodo,
  refrescarCatalogo,
} from '@/lib/cyber-aplicar'

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
    // El mismo código que corre solo cuando llega la fecha. Dos caminos que
    // escriben precios no pueden ser dos copias: el día que cambie el piso de
    // margen en uno, el otro seguiría vendiendo abajo del piso.
    const r = await aplicarDescuento(elegidas, snaps, cfg, forzar)
    hechos.push(...r.hechos)
    omitidos.push(...r.omitidos)
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

  if (hechos.length > 0) refrescarCatalogo()

  return NextResponse.json({
    ok: true,
    accion,
    cambiados: hechos.length,
    omitidos,
    detalle: hechos,
  })
}
