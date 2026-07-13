import { NextRequest, NextResponse } from 'next/server'
import { procesarJobsPendientes } from '@/lib/procesar-jobs'

// Batch chico para caber en el límite de duración de la función serverless.
const BATCH = 10

export const maxDuration = 60

/**
 * Cron de RESPALDO que procesa la cola de jobs. El disparo principal es
 * inmediato via `after()` en el webhook; este cron levanta lo que haya quedado
 * (reintentos con backoff, o si el after() murió). Protegido con CRON_SECRET:
 * Vercel envía `Authorization: Bearer <CRON_SECRET>` si la env var está seteada.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  const resultado = await procesarJobsPendientes(BATCH)
  return NextResponse.json(resultado)
}
