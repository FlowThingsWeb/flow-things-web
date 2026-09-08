import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export const maxDuration = 60

/**
 * Avisa qué campañas de Mercado Libre están disponibles y no se usan.
 *
 * ML ofrece campañas por publicación —DEAL, SMART, PRICE_DISCOUNT— y las que
 * no se aceptan quedan en estado `candidate` sin que nadie se entere. El ciclo
 * diario entra en las que respetan el margen, así que lo que aparece acá es lo
 * que quedó afuera: sirve para mirarlo a mano y decidir.
 *
 * El CRM busca las candidatas y arma el HTML; acá sólo se manda. Reemplaza al
 * mail "promociones disponibles" que mandaba n8n.
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

  const r = await fetch(`${url}/api/integraciones/resumen-promociones`, {
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

  const { total, promos, html } = await r.json()

  // Ninguna campaña sin aprovechar es una buena noticia, pero no una que
  // merezca un mail todos los días.
  if (!total || !html) {
    return NextResponse.json({ enviado: false, motivo: 'sin campañas sin aprovechar' })
  }
  if (!process.env.ADMIN_EMAIL) {
    return NextResponse.json({ enviado: false, motivo: 'falta ADMIN_EMAIL' })
  }

  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    asunto: `Mercado Libre: ${total} publicación(es) con campaña sin aprovechar`,
    cuerpo: html,
  })

  return NextResponse.json({ enviado: true, total, promos })
}
