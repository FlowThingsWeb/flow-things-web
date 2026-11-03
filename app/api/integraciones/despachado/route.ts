import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  sendEmail,
  renderTemplateEstricto,
  DEFAULT_LLEGA_HOY_ASUNTO,
  DEFAULT_LLEGA_HOY_CUERPO,
} from '@/lib/email'

/**
 * POST /api/integraciones/despachado
 *
 * El CRM avisa que un pedido del envío en el día salió del depósito, y acá se
 * le manda el mail al comprador. El mail sale desde la tienda y no desde el
 * CRM porque es la tienda la que le habla al comprador: es su remitente, su
 * plantilla y su casilla, y el comprador nunca supo que existe un CRM.
 *
 * No dice quién lo lleva ni da seguimiento, a propósito: el reparto lo
 * hacemos nosotros, no hay nada que rastrear, y nombrar al cadete sólo le da
 * al comprador un teléfono equivocado al que llamar. Para los envíos con
 * courier y tracking está el otro mail, el de /api/admin/ordenes/despachar.
 *
 * Es idempotente: si el aviso ya salió, no se manda de nuevo. Un mail
 * repetido al comprador es peor que no avisar.
 *
 * Auth: el mismo secreto compartido que el push de stock y el de packs.
 */

export const runtime = 'nodejs'

function secretoValido(request: NextRequest): boolean {
  const esperado = process.env.CRM_WEBHOOK_SECRET
  if (!esperado) {
    console.error('[integraciones/despachado] CRM_WEBHOOK_SECRET no configurado')
    return false
  }
  const recibido = request.headers.get('x-crm-secret') ?? ''
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Hoy en Buenos Aires: el mail dice "llega hoy" y el servidor está en UTC. */
function fechaHoy(): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())
}

export async function POST(request: NextRequest) {
  if (!secretoValido(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: { orden_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const ordenId = String(body.orden_id ?? '').trim()
  if (!ordenId) {
    return NextResponse.json({ error: 'Falta orden_id' }, { status: 400 })
  }

  const { data: orden, error } = await supabaseAdmin
    .from('ordenes')
    .select('id, datos_comprador')
    .eq('id', ordenId)
    .single()

  if (error || !orden) {
    return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dc = (orden.datos_comprador as any) ?? {}

  if (dc.aviso_llega_hoy_at) {
    return NextResponse.json({ ok: true, yaAvisado: true })
  }

  const email = String(dc.email ?? '').trim()
  if (!email) {
    return NextResponse.json(
      { error: 'La orden no tiene email del comprador' },
      { status: 400 },
    )
  }

  // La dirección completa, como la cargó el comprador. Es lo único que le
  // permite darse cuenta de que el paquete va a la dirección equivocada
  // mientras todavía se puede hacer algo.
  const direccion = [
    [dc.direccion, dc.piso, dc.departamento].filter(Boolean).join(' '),
    [dc.ciudad, dc.provincia].filter(Boolean).join(', '),
  ]
    .filter(Boolean)
    .join(' · ')

  const vars: Record<string, string> = {
    nombre: String(dc.nombre ?? 'Hola').trim() || 'Hola',
    orden_id: ordenId,
    fecha: fechaHoy(),
    direccion,
  }

  const asunto = renderTemplateEstricto(DEFAULT_LLEGA_HOY_ASUNTO, vars, 'llega-hoy (asunto)')
  const cuerpo = renderTemplateEstricto(DEFAULT_LLEGA_HOY_CUERPO, vars, 'llega-hoy')

  try {
    await sendEmail({ to: email, asunto, cuerpo })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[integraciones/despachado] no se pudo enviar:', err)
    return NextResponse.json({ error: message }, { status: 502 })
  }

  /**
   * La marca se escribe DESPUÉS de mandar: si el envío falla, el CRM
   * reintenta y el comprador se entera. Al revés, un error de SMTP dejaría el
   * pedido marcado como avisado sin que nadie haya recibido nada.
   */
  await supabaseAdmin
    .from('ordenes')
    .update({
      datos_comprador: { ...dc, aviso_llega_hoy_at: new Date().toISOString() },
    })
    .eq('id', ordenId)

  return NextResponse.json({ ok: true })
}
