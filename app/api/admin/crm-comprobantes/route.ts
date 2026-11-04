import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { crmHabilitado, notificarComprobantesCRM } from '@/lib/crm'

/**
 * POST /api/admin/crm-comprobantes
 *
 * Le manda al CRM los comprobantes de las órdenes que ya estaban facturadas
 * antes de que la tienda supiera avisarle: hasta ahora el CAE quedaba sólo de
 * este lado.
 *
 * De a tandas, porque son una llamada al CRM por orden y la función tiene
 * límite de duración. Devuelve cuántas quedan: se vuelve a llamar hasta que
 * `restantes` sea 0. Repetirlo no hace daño —el CRM no pisa una factura ya
 * cargada ni duplica la nota de crédito—, así que una orden que falla en una
 * tanda se reintenta en la siguiente.
 *
 * Con `ordenId` hace una sola, que es lo que sirve para probar.
 */

export const runtime = 'nodejs'
export const maxDuration = 60

/** Margen para contestar antes de que la función se corte. */
const CORTE_MS = 45_000

export async function POST(request: NextRequest) {
  const unauth = await verifyAdminToken(request)
  if (unauth) return unauth

  if (!crmHabilitado()) {
    return NextResponse.json({ error: 'La integración con el CRM no está configurada.' }, { status: 400 })
  }

  let body: { ordenId?: string } = {}
  try {
    body = await request.json()
  } catch {
    /* sin body = todas */
  }

  let query = supabaseAdmin
    .from('ordenes')
    .select('id, created_at')
    .not('datos_comprador->>factura_cae', 'is', null)
    .order('created_at', { ascending: true })

  if (body.ordenId) query = query.eq('id', body.ordenId)

  const { data: ordenes, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!ordenes?.length) {
    return NextResponse.json({ ok: true, informadas: 0, restantes: 0, detalle: [] })
  }

  const arranque = Date.now()
  const detalle: { ordenId: string; ok: boolean; error?: string }[] = []

  for (const orden of ordenes) {
    if (Date.now() - arranque > CORTE_MS) break
    try {
      await notificarComprobantesCRM(orden.id)
      detalle.push({ ordenId: orden.id, ok: true })
    } catch (err) {
      detalle.push({
        ordenId: orden.id,
        ok: false,
        error: (err instanceof Error ? err.message : String(err)).slice(0, 200),
      })
    }
  }

  const ok = detalle.filter((d) => d.ok).length

  return NextResponse.json({
    ok: true,
    procesadas: detalle.length,
    informadas: ok,
    fallaron: detalle.length - ok,
    restantes: ordenes.length - detalle.length,
    detalle,
  })
}
