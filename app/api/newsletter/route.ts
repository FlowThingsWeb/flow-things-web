import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getConfig } from '@/lib/config'
import { sendEmail, renderTemplate } from '@/lib/email'
import { DEFAULT_NEWSLETTER_ASUNTO, DEFAULT_NEWSLETTER_CUERPO } from '@/lib/email-constants'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/newsletter  { email }
 * Suscribe el email y envía un cupón de bienvenida (solo la primera vez).
 * El código del cupón sale de config (newsletter_cupon_codigo) — recordá crearlo
 * en /admin/descuentos para que sea válido en el checkout.
 */
export async function POST(request: NextRequest) {
  const { email } = await request.json().catch(() => ({}))
  const mail = typeof email === 'string' ? email.trim().toLowerCase() : ''

  if (!EMAIL_RE.test(mail)) {
    return NextResponse.json({ error: 'Email inválido.' }, { status: 400 })
  }

  // Insertar; si ya existe, no reenviar el cupón.
  const { error } = await supabaseAdmin
    .from('newsletter_suscriptores')
    .insert({ email: mail })

  if (error) {
    // 23505 = duplicado → ya estaba suscripto
    if ((error as any).code === '23505') {
      return NextResponse.json({ success: true, yaSuscripto: true })
    }
    console.error('[newsletter] error al suscribir:', error.message)
    return NextResponse.json({ error: 'No se pudo suscribir.' }, { status: 500 })
  }

  // Enviar cupón de bienvenida
  try {
    const cfg = await getConfig()
    const cupon = cfg.newsletter_cupon_codigo || 'BIENVENIDO10'
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://flowthings.com.ar').replace(/\/$/, '')
    const cuerpo = renderTemplate(DEFAULT_NEWSLETTER_CUERPO, {
      cupon,
      link: `${appUrl}/productos`,
    })
    await sendEmail({ to: mail, asunto: DEFAULT_NEWSLETTER_ASUNTO, cuerpo })
  } catch (e: any) {
    console.error('[newsletter] error enviando cupón:', e.message)
    // El suscriptor quedó guardado igual; no fallamos la request.
  }

  return NextResponse.json({ success: true })
}
