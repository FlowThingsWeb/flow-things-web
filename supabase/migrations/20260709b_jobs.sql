-- =========================================================
-- Flow Things — Cola de jobs en segundo plano
-- Ejecutar en Supabase → SQL Editor
-- =========================================================
--
-- El webhook de pagos y el broadcast de emails encolan trabajo acá y responden
-- rápido; un Vercel Cron (/api/cron/procesar-jobs) procesa los jobs cada minuto.

CREATE TABLE IF NOT EXISTS jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo         text NOT NULL,                       -- 'email' | 'post_pago'
  payload      jsonb NOT NULL DEFAULT '{}',
  estado       text NOT NULL DEFAULT 'pending',     -- pending | processing | done | error
  intentos     int  NOT NULL DEFAULT 0,
  max_intentos int  NOT NULL DEFAULT 5,
  error        text,
  run_after    timestamptz NOT NULL DEFAULT now(),  -- no procesar antes de este momento (backoff)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_pendientes_idx ON jobs (estado, run_after);

-- RLS: solo service_role (backend). Nadie más toca la cola.
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "jobs_service_role" ON jobs;
CREATE POLICY "jobs_service_role" ON jobs
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Reclamo atómico de un lote de jobs: los marca 'processing' y los devuelve.
-- FOR UPDATE SKIP LOCKED permite que varias corridas del cron no se pisen.
CREATE OR REPLACE FUNCTION reclamar_jobs(p_limit int)
RETURNS SETOF jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE jobs j
  SET estado = 'processing', updated_at = now()
  WHERE j.id IN (
    SELECT id FROM jobs
    WHERE estado = 'pending' AND run_after <= now()
    ORDER BY run_after
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
END;
$$;
