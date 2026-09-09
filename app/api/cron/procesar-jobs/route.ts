import { NextRequest, NextResponse } from 'next/server'
import { procesarJobsPendientes } from '@/lib/procesar-jobs'
import { sendEmail } from '@/lib/email'
import {
  cronsFaltantes,
  htmlDeFaltantes,
  registrarLatido,
  yaSeAvisoHoy,
  CLAVE_AVISO,
} from '@/lib/vigilar-crons'

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
  const vigilancia = await avisarCronsCaidos()
  return NextResponse.json({ ...resultado, vigilancia })
}

/**
 * Avisa qué crons de precios no corrieron hoy.
 *
 * Va colgado de acá y no en su propio workflow por una razón concreta: un
 * vigilante que depende de un `schedule` de GitHub puede no correr por la
 * misma razón que vigila, y entonces el silencio significa las dos cosas
 * opuestas. Esta ruta la disparan DOS cosas distintas —el cron de Vercel, que
 * es puntual, y el workflow de GitHub, que es frecuente— así que para que el
 * aviso se pierda tienen que fallar las dos.
 *
 * Nunca rompe el procesamiento de la cola: los mails de los pedidos importan
 * más que el aviso.
 */
async function avisarCronsCaidos(): Promise<{ faltantes: number; avisado: boolean; motivo?: string }> {
  try {
    // Un mail por día alcanza: esta ruta corre varias veces y un cron caído
    // seguiría caído en cada pasada.
    if (await yaSeAvisoHoy()) return { faltantes: 0, avisado: false, motivo: 'ya se avisó hoy' }

    const faltantes = await cronsFaltantes()
    if (faltantes.length === 0) return { faltantes: 0, avisado: false }

    const to = process.env.ADMIN_EMAIL
    if (!to) return { faltantes: faltantes.length, avisado: false, motivo: 'falta ADMIN_EMAIL' }

    const n = faltantes.length
    await sendEmail({
      to,
      asunto: `Crons de precios: ${n} ${n === 1 ? 'no corrió' : 'no corrieron'} hoy`,
      cuerpo: htmlDeFaltantes(faltantes),
    })
    await registrarLatido(CLAVE_AVISO)
    return { faltantes: n, avisado: true }
  } catch (e: any) {
    console.error('[vigilar-crons] No se pudo avisar:', e?.message ?? e)
    return { faltantes: 0, avisado: false, motivo: 'error al vigilar' }
  }
}
