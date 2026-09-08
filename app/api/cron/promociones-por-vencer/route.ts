import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export const maxDuration = 60

/**
 * Avisa qué publicaciones se quedan sin descuento y sin reemplazo.
 *
 * Lo importante no es la lista de campañas que vencen —el ciclo le busca
 * relevo a casi todas y avisar por ésas es ruido— sino las que quedan SIN
 * relevo: el día que la campaña termina vuelven a su precio de lista, que está
 * inflado a propósito para que el descuento aterrizara en el precio objetivo.
 * Una publicación así queda cara y sin oferta hasta que alguien la mire.
 *
 * El HTML lo arma el CRM, que es donde viven los datos; acá sólo se manda.
 * Reemplaza al mail "ofertas por vencer" que mandaba n8n.
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

  const dias = new URL(request.url).searchParams.get('dias') ?? '7'

  const r = await fetch(`${url}/api/integraciones/promociones-por-vencer?dias=${dias}`, {
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

  const { hay_novedades, html, resumen } = await r.json()

  // Sin vencimientos cerca no se manda nada: un mail diario que dice "no pasó
  // nada" se deja de leer, y entonces tampoco se lee el que sí importa.
  if (!hay_novedades) {
    return NextResponse.json({ enviado: false, motivo: 'sin vencimientos cercanos' })
  }
  if (!process.env.ADMIN_EMAIL) {
    return NextResponse.json({ enviado: false, motivo: 'falta ADMIN_EMAIL' })
  }

  const sinRelevo = resumen?.sin_relevo ?? 0
  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    asunto: sinRelevo
      ? `Mercado Libre: ${sinRelevo} publicación(es) se quedan sin descuento`
      : `Mercado Libre: vencimientos de promociones cubiertos`,
    cuerpo: html,
  })

  return NextResponse.json({ enviado: true, resumen })
}
