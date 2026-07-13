import { reclamarJobs, completarJob, fallarJob, Job } from '@/lib/jobs'
import { sendEmail } from '@/lib/email'
import { procesarPagoAprobado } from '@/lib/procesar-pago'

/**
 * Procesa un lote de jobs de la cola. Usado tanto por el cron de respaldo
 * (/api/cron/procesar-jobs) como por el disparo inmediato via `after()` en el
 * webhook. reclamarJobs marca cada job como 'processing' de forma atómica, así
 * que un job se ejecuta UNA sola vez aunque el cron y el after() corran a la par.
 */
export async function procesarJobsPendientes(batch: number): Promise<{ procesados: number; ok: number; fail: number }> {
  const jobs = await reclamarJobs(batch)
  let ok = 0
  let fail = 0

  for (const job of jobs) {
    try {
      await procesarJob(job)
      await completarJob(job.id)
      ok++
    } catch (e: any) {
      console.error(`[jobs] Job ${job.id} (${job.tipo}) falló:`, e.message)
      await fallarJob(job, String(e?.message ?? e))
      fail++
    }
  }

  return { procesados: jobs.length, ok, fail }
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
