import { NextRequest, NextResponse } from 'next/server'
import { registrarLatido, CRONS_DE_PRECIOS } from '@/lib/vigilar-crons'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/latido?clave=ciclo-promociones[&ok=0&detalle=...]
 *
 * Para los crons que no viven en esta app. Los de la tienda registran su latido
 * solos desde su propia ruta; el ciclo de promociones corre en el CRM, así que
 * su workflow avisa por acá.
 *
 * Sólo acepta claves de la lista de vigilados: si no, cualquiera con el secreto
 * podría llenar la tabla de claves inventadas que nadie mira, y peor, tapar con
 * ruido las que sí importan.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const clave = req.nextUrl.searchParams.get('clave')?.trim()
  if (!clave || !CRONS_DE_PRECIOS.some(c => c.clave === clave)) {
    return NextResponse.json(
      { error: 'clave desconocida', validas: CRONS_DE_PRECIOS.map(c => c.clave) },
      { status: 400 },
    )
  }

  const ok = req.nextUrl.searchParams.get('ok') !== '0'
  const detalle = req.nextUrl.searchParams.get('detalle') ?? undefined
  const guardado = await registrarLatido(clave, ok, detalle)

  // 500 si no se guardó: el workflow que llama ignora el error a propósito
  // (el latido no puede tumbar al cron), pero el código honesto deja el motivo
  // en el log del run, que es donde alguien lo va a buscar.
  return NextResponse.json({ clave, ok, guardado }, { status: guardado ? 200 : 500 })
}
