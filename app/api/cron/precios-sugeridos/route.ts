import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export const maxDuration = 60

/**
 * Manda por mail el precio recomendado de cada publicación de Mercado Libre.
 *
 * Es el mismo mail que venía mandando n8n. La diferencia es de dónde sale la
 * lista de publicaciones: n8n la armaba él, y ahora la arma el CRM desde
 * `ml_listings` —por eso acá se llama al endpoint con GET y sin body—. El CRM
 * devuelve el HTML ya armado; la tienda lo manda, porque es la que tiene
 * mailer y el CRM no.
 *
 * Hermano de avisar-ml: aquel cuenta lo que el ciclo YA movió, éste sugiere lo
 * que habría que mover. Los dos juntos son lo que se recibía de n8n.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const url = process.env.CRM_URL
  const crmSecret = process.env.CRM_SECRET
  if (!url) return NextResponse.json({ error: 'Falta CRM_URL' }, { status: 500 })
  if (!crmSecret) return NextResponse.json({ error: 'Falta CRM_SECRET' }, { status: 500 })

  const r = await fetch(`${url}/api/integraciones/precios-sugeridos`, {
    headers: { Authorization: `Bearer ${crmSecret}` },
    cache: 'no-store',
  })
  if (!r.ok) {
    const detalle = await r.text()
    return NextResponse.json(
      { error: `El CRM devolvió ${r.status}`, detalle: detalle.slice(0, 300) },
      { status: 502 },
    )
  }

  const { total, a_cambiar, sin_costo, html } = await r.json()

  if (!html) {
    return NextResponse.json({ enviado: false, motivo: 'el CRM no devolvió HTML' })
  }
  if (!process.env.ADMIN_EMAIL) {
    return NextResponse.json({ enviado: false, motivo: 'falta ADMIN_EMAIL' })
  }

  /**
   * Este sí se manda siempre, al revés que avisar-ml.
   *
   * Aquel avisa movimientos y sin movimientos no tiene nada que decir. Éste es
   * el estado de los precios: que ninguno necesite cambio es información, y de
   * las buenas.
   */
  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    asunto: `Mercado Libre: ${a_cambiar} de ${total} publicaciones para ajustar`,
    cuerpo: html,
  })

  return NextResponse.json({ enviado: true, total, a_cambiar, sin_costo })
}
