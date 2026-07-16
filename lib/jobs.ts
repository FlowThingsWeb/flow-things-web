import { supabaseAdmin } from './supabaseAdmin'

export type JobTipo = 'email' | 'post_pago' | 'crm_venta'

export interface Job {
  id: string
  tipo: JobTipo
  payload: Record<string, any>
  estado: string
  intentos: number
  max_intentos: number
  error: string | null
  run_after: string
}

/** Encola un job para procesamiento en segundo plano (via /api/cron/procesar-jobs). */
export async function enqueueJob(
  tipo: JobTipo,
  payload: Record<string, any>,
  opts?: { maxIntentos?: number; runAfter?: Date }
): Promise<void> {
  const { error } = await supabaseAdmin.from('jobs').insert({
    tipo,
    payload,
    max_intentos: opts?.maxIntentos ?? 5,
    run_after: (opts?.runAfter ?? new Date()).toISOString(),
  })
  if (error) {
    // No cortamos el flujo del caller por un fallo de encolado, pero lo logueamos.
    console.error(`[jobs] Error encolando job ${tipo}:`, error.message)
    throw new Error(`No se pudo encolar el job ${tipo}: ${error.message}`)
  }
}

/** Encola varios jobs de una en un solo insert. */
export async function enqueueJobs(
  tipo: JobTipo,
  payloads: Record<string, any>[],
  opts?: { maxIntentos?: number }
): Promise<void> {
  if (payloads.length === 0) return
  const rows = payloads.map((payload) => ({
    tipo,
    payload,
    max_intentos: opts?.maxIntentos ?? 5,
  }))
  const { error } = await supabaseAdmin.from('jobs').insert(rows)
  if (error) {
    console.error(`[jobs] Error encolando ${payloads.length} jobs ${tipo}:`, error.message)
    throw new Error(`No se pudieron encolar jobs ${tipo}: ${error.message}`)
  }
}

/** Reclama atómicamente un lote de jobs pendientes (los marca 'processing'). */
export async function reclamarJobs(limit: number): Promise<Job[]> {
  const { data, error } = await supabaseAdmin.rpc('reclamar_jobs', { p_limit: limit })
  if (error) {
    console.error('[jobs] Error reclamando jobs:', error.message)
    return []
  }
  return (data ?? []) as Job[]
}

/** Marca un job como completado. */
export async function completarJob(id: string): Promise<void> {
  await supabaseAdmin
    .from('jobs')
    .update({ estado: 'done', updated_at: new Date().toISOString() })
    .eq('id', id)
}

/**
 * Marca un job como fallido. Si aún quedan intentos, lo re-agenda con backoff
 * exponencial (pending). Si se agotaron, lo deja en 'error'.
 */
export async function fallarJob(job: Job, errMsg: string): Promise<void> {
  const intentos = job.intentos + 1
  const agotado = intentos >= job.max_intentos
  const backoffMin = Math.min(60, 2 ** intentos) // 2,4,8,16,32,60 min
  await supabaseAdmin
    .from('jobs')
    .update({
      estado: agotado ? 'error' : 'pending',
      intentos,
      error: errMsg.slice(0, 1000),
      run_after: new Date(Date.now() + backoffMin * 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id)
}
