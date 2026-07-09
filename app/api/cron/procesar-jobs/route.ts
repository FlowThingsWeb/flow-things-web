import { NextRequest, NextResponse } from 'next/server'
import { reclamarJobs, completarJob, fallarJob, Job } from '@/lib/jobs'
import { sendEmail } from '@/lib/email'
import { procesarPagoAprobado } from '@/lib/procesar-pago'

// Batch chico para caber en el límite de duración de la función serverless.
const BATCH = 10

export const maxDuration = 60

/**
 * Cron que procesa la cola de jobs. Lo dispara Vercel Cron (ver vercel.json)
 * cada minuto. Protegido con CRON_SECRET: Vercel envía
 * `Authorization: Bearer <CRON_SECRET>` si la env var está seteada.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }
  }

  const jobs = await reclamarJobs(BATCH)
  let ok = 0
  let fail = 0

  for (const job of jobs) {
    try {
      await procesarJob(job)
      await completarJob(job.id)
      ok++
    } catch (e: any) {
      console.error(`[cron] Job ${job.id} (${job.tipo}) falló:`, e.message)
      await fallarJob(job, String(e?.message ?? e))
      fail++
    }
  }

  return NextResponse.json({ procesados: jobs.length, ok, fail })
}

async function procesarJob(job: Job): Promise<void> {
  switch (job.tipo) {
    case 'email': {
      const { to, asunto, cuerpo } = job.payload
      if (!to || !asunto || !cuerpo) throw new Error('payload de email incompleto')
      await sendEmail({ to, asunto, cuerpo })
      return
    }
    case 'post_pago': {
      const { ordenId } = job.payload
      if (!ordenId) throw new Error('payload post_pago sin ordenId')
      await procesarPagoAprobado(ordenId)
      return
    }
    default:
      throw new Error(`tipo de job desconocido: ${job.tipo}`)
  }
}
