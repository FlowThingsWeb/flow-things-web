import { NextRequest, NextResponse } from 'next/server'
import { procesarJobsPendientes } from '@/lib/procesar-jobs'
import { sendEmail } from '@/lib/email'
import { revisarFeed, htmlDeProblemasFeed } from '@/lib/vigilar-feed'
import { anotarFallaML, fallaMLDesde, olvidarFallaML, sincronizarLatidoCiclo } from '@/lib/vigilar-crons'
import {
  cronsFaltantes,
  htmlDeFaltantes,
  htmlDeSaludML,
  marcarAviso,
  marcarAvisados,
  revisarSaludML,
  sinAvisarHoy,
  yaSeAviso,
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
  const ml = await avisarMLRoto()
  const feed = await avisarFeedRoto()
  return NextResponse.json({ ...resultado, vigilancia, ml, feed })
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
    const faltantes = await cronsFaltantes()
    if (faltantes.length === 0) return { faltantes: 0, avisado: false }

    // Se avisa una vez por día POR CRON. Esta ruta corre varias veces y un cron
    // caído sigue caído en cada pasada, pero los plazos vencen escalonados: con
    // una sola marca diaria, avisar del primero silenciaba a los demás hasta el
    // día siguiente.
    const aAvisar = await sinAvisarHoy(faltantes)
    if (aAvisar.length === 0) {
      return { faltantes: faltantes.length, avisado: false, motivo: 'ya se avisó de todos hoy' }
    }

    const to = process.env.ADMIN_EMAIL
    if (!to) return { faltantes: aAvisar.length, avisado: false, motivo: 'falta ADMIN_EMAIL' }

    const n = aAvisar.length
    await sendEmail({
      to,
      asunto: `Crons de precios: ${n} ${n === 1 ? 'no corrió' : 'no corrieron'} hoy`,
      cuerpo: htmlDeFaltantes(aAvisar),
    })
    // Después de mandar: si falla el mail, no queda marcado y se reintenta en
    // la pasada siguiente.
    await marcarAvisados(aAvisar)
    return { faltantes: n, avisado: true }
  } catch (e: any) {
    console.error('[vigilar-crons] No se pudo avisar:', e?.message ?? e)
    return { faltantes: 0, avisado: false, motivo: 'error al vigilar' }
  }
}

/**
 * Avisa si la conexión con Mercado Libre se rompió.
 *
 * Va aparte de los crons caídos porque son problemas de distinta urgencia: un
 * cron que no corrió se resuelve solo mañana; una renovación de token rota no
 * se arregla sola y deja sin funcionar precios, promociones, stock y ventas al
 * mismo tiempo. Mezclarlos en el mismo mail escondería el grave adentro del
 * leve.
 */
async function avisarMLRoto(): Promise<{ sano: boolean | null; avisado: boolean; motivo?: string }> {
  try {
    const salud = await revisarSaludML()
    if (!salud) return { sano: null, avisado: false, motivo: 'CRM no configurado' }

    // El ciclo corre en el CRM: su latido lo trae esta misma consulta, sacado
    // de los datos que dejó al trabajar.
    await sincronizarLatidoCiclo(salud.ciclo_ultima_corrida)

    if (salud.sano) {
      // Se olvida la falla anterior: si volvió solo, no hay nada que avisar.
      await olvidarFallaML()
      return { sano: true, avisado: false }
    }

    /**
     * Si NO se pudo hablar con el CRM, se exige que la falla persista.
     *
     * El 14/9/2026 este aviso salió por un 500 pasajero: el token de ML se
     * había renovado cuatro horas antes y last_error estaba en null. Un
     * arranque en frío no es una integración rota, y un aviso que grita por un
     * pestañeo se deja de leer — que es exactamente lo que este vigilante
     * existe para evitar.
     *
     * Cuando el CRM SÍ contesta y dice que está rota, se avisa de una: eso no
     * se arregla solo.
     */
    const desde = await fallaMLDesde()
    if (!salud.alcanzado && !desde) {
      await anotarFallaML(salud.problemas.join(' | '))
      return { sano: false, avisado: false, motivo: 'primera falla, se espera a la próxima pasada' }
    }

    // Una vez por día alcanza: mientras esté rota va a seguir rota en cada
    // pasada, y repetir el mismo mail cada tres horas lo vuelve ruido.
    if (await yaSeAviso('salud-ml')) {
      return { sano: false, avisado: false, motivo: 'ya se avisó hoy' }
    }

    const to = process.env.ADMIN_EMAIL
    if (!to) return { sano: false, avisado: false, motivo: 'falta ADMIN_EMAIL' }

    await sendEmail({
      to,
      asunto: salud.alcanzado
        ? 'Mercado Libre: la conexión está rota'
        : 'Mercado Libre: no se pudo consultar la conexión',
      cuerpo: htmlDeSaludML(salud, desde),
    })
    await marcarAviso('salud-ml', salud.problemas.join(' | '))
    if (!salud.alcanzado && !desde) await anotarFallaML(salud.problemas.join(' | '))
    return { sano: false, avisado: true }
  } catch (e: any) {
    console.error('[vigilar-crons] No se pudo revisar la salud de ML:', e?.message ?? e)
    return { sano: null, avisado: false, motivo: 'error al revisar' }
  }
}

/**
 * Avisa si el feed que lee Google se rompió.
 *
 * Aparte del aviso de crons por la misma razón que el de ML: un cron que no
 * corrió se resuelve solo mañana, un feed inválido saca la tienda entera de
 * Google y no se arregla solo. Y aparte del de ML porque se arreglan en lugares
 * distintos —uno es reconectar una cuenta, el otro es un deploy—.
 */
async function avisarFeedRoto(): Promise<{ problemas: number; avisado: boolean; motivo?: string }> {
  try {
    const problemas = await revisarFeed()
    if (problemas.length === 0) return { problemas: 0, avisado: false }

    // Mientras esté roto va a seguir roto en cada pasada; un mail por día basta.
    if (await yaSeAviso('feed')) {
      return { problemas: problemas.length, avisado: false, motivo: 'ya se avisó hoy' }
    }

    const to = process.env.ADMIN_EMAIL
    if (!to) return { problemas: problemas.length, avisado: false, motivo: 'falta ADMIN_EMAIL' }

    const n = problemas.length
    await sendEmail({
      to,
      asunto: `Google Shopping: el feed tiene ${n} problema${n === 1 ? '' : 's'}`,
      cuerpo: htmlDeProblemasFeed(problemas),
    })
    await marcarAviso('feed', problemas.map(p => p.clave).join(' | '))
    return { problemas: n, avisado: true }
  } catch (e: any) {
    console.error('[vigilar-feed] No se pudo revisar el feed:', e?.message ?? e)
    return { problemas: 0, avisado: false, motivo: 'error al revisar' }
  }
}
