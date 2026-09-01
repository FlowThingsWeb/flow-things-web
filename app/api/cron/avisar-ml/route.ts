import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

export const maxDuration = 60

/**
 * Manda por mail lo que se movió en los precios de Mercado Libre.
 *
 * El HTML lo arma el CRM, que es donde viven los datos; acá sólo se manda,
 * porque la tienda es la que tiene mailer configurado y el CRM no.
 *
 * Antes este aviso dependía de n8n. Se lo sacamos de encima a propósito: es el
 * eslabón que más falló —se venció su credencial de ML y nadie se enteró por
 * dos días, con 56 publicaciones caras esperando— y no hace falta un servicio
 * de terceros para mandar un mail entre dos proyectos propios.
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

  const horas = new URL(request.url).searchParams.get('horas') ?? '24'

  const r = await fetch(`${url}/api/integraciones/reporte-precios-ml?horas=${horas}`, {
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

  // Sin movimientos no se manda nada: un mail diario que dice "no pasó nada"
  // se deja de leer, y entonces tampoco se lee el que sí importa.
  if (!hay_novedades) {
    return NextResponse.json({ enviado: false, motivo: 'sin movimientos' })
  }

  if (!process.env.ADMIN_EMAIL) {
    return NextResponse.json({ enviado: false, motivo: 'falta ADMIN_EMAIL' })
  }

  const partes = [
    resumen?.con_promocion ? `${resumen.con_promocion} en promoción` : null,
    resumen?.bajadas ? `${resumen.bajadas} bajada(s) de precio` : null,
  ].filter(Boolean)

  await sendEmail({
    to: process.env.ADMIN_EMAIL,
    asunto: `Mercado Libre: ${partes.join(' · ')}`,
    cuerpo: html,
  })

  return NextResponse.json({ enviado: true, resumen })
}
