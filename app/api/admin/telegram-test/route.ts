import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminToken } from '@/lib/admin-auth'
import { sendTelegram } from '@/lib/telegram'

// GET — envía un mensaje de prueba al chat configurado (TELEGRAM_CHAT_ID).
// Admin-gated; se abre desde el navegador estando logueado.
export async function GET(req: NextRequest) {
  const unauth = await verifyAdminToken(req)
  if (unauth) return unauth

  const hayToken = !!process.env.TELEGRAM_BOT_TOKEN
  const hayChat = !!process.env.TELEGRAM_CHAT_ID
  if (!hayToken || !hayChat) {
    return NextResponse.json({
      ok: false,
      error: `Falta configurar ${!hayToken ? 'TELEGRAM_BOT_TOKEN' : ''}${!hayToken && !hayChat ? ' y ' : ''}${!hayChat ? 'TELEGRAM_CHAT_ID' : ''} en Vercel.`,
    }, { status: 400 })
  }

  await sendTelegram(
    '✅ <b>Test de Telegram</b>\nFlow Things web — si ves esto en el grupo, quedó configurado 🎉',
  )
  return NextResponse.json({ ok: true, mensaje: 'Mensaje de prueba enviado al chat configurado.' })
}
