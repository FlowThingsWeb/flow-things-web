import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  sendEmail,
  renderTemplate,
  buildTrackingBoton,
  DEFAULT_DESPACHO_ASUNTO,
  DEFAULT_DESPACHO_CUERPO,
} from '@/lib/email'

export async function POST(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  let body: {
    ordenId?: string
    courier?: string
    tracking_numero?: string
    tracking_url?: string
  } = {}
  try { body = await req.json() } catch { /* empty */ }

  const { ordenId, courier, tracking_numero, tracking_url } = body

  if (!ordenId) return NextResponse.json({ error: 'Falta ordenId' }, { status: 400 })
  if (!courier) return NextResponse.json({ error: 'Falta el courier' }, { status: 400 })
  if (!tracking_numero) return NextResponse.json({ error: 'Falta el número de seguimiento' }, { status: 400 })

  try {
    // Cargar datos de la orden
    const { data: orden, error: ordenErr } = await supabaseAdmin
      .from('ordenes')
      .select('datos_comprador, id, created_at')
      .eq('id', ordenId)
      .single()

    if (ordenErr || !orden) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
    }

    const compradorData = orden.datos_comprador ?? {}
    const email = compradorData.email

    if (!email) {
      return NextResponse.json({ error: 'La orden no tiene email del comprador' }, { status: 400 })
    }

    // Cargar template de despacho desde Supabase config
    const { data: cfgRows } = await supabaseAdmin
      .from('configuracion')
      .select('clave, valor')
      .in('clave', ['notif_despacho_asunto', 'notif_despacho_cuerpo'])

    const cfg: Record<string, string> = {}
    ;(cfgRows || []).forEach((r: { clave: string; valor: string }) => { cfg[r.clave] = r.valor })

    const asuntoTemplate = cfg.notif_despacho_asunto || DEFAULT_DESPACHO_ASUNTO
    const cuerpoTemplate = cfg.notif_despacho_cuerpo || DEFAULT_DESPACHO_CUERPO

    // Construir el botón de tracking
    const trackingBoton = buildTrackingBoton(tracking_url || '', '#7C3AED')

    const vars: Record<string, string> = {
      nombre:          compradorData.nombre || 'cliente',
      orden_id:        String(ordenId),
      courier:         courier,
      tracking_numero: tracking_numero,
      tracking_url:    tracking_url || '',
      tracking_boton:  trackingBoton,
      fecha:           new Date().toLocaleDateString('es-AR'),
    }

    const asunto = renderTemplate(asuntoTemplate, vars)
    const cuerpo = renderTemplate(cuerpoTemplate, vars)

    await sendEmail({ to: email, asunto, cuerpo })

    // Guardar info de despacho en la orden
    await supabaseAdmin
      .from('ordenes')
      .update({
        datos_comprador: {
          ...compradorData,
          despacho_courier: courier,
          despacho_tracking: tracking_numero,
          despacho_tracking_url: tracking_url || null,
          despacho_fecha: new Date().toISOString(),
        },
      })
      .eq('id', ordenId)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[despachar]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
