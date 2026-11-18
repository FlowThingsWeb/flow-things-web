-- =========================================================
-- Latidos de los crons.
--
-- El 9/9/2026 no llegó ningún aviso de precios. No falló nada: los workflows
-- simplemente no corrieron. GitHub demora los `schedule` bajo carga y los
-- descarta enteros sin dejar rastro — no hay run fallido, no hay run. Desde
-- afuera "tarde" y "nunca" se ven igual, y por eso nadie se entera.
--
-- Detectar la falta por el mail que no llegó no sirve: de los cuatro avisos
-- diarios, tres callan a propósito cuando no hay nada que decir (sin
-- vencimientos cerca, sin campañas sin aprovechar, sin movimientos). Un mail
-- ausente puede ser un día tranquilo o un cron muerto, y confundirlos daría
-- falsas alarmas hasta que se dejen de leer.
--
-- Por eso cada cron deja constancia de que corrió, y el vigilante compara
-- contra lo que se esperaba. Un cron que no corrió no deja latido: eso sí es
-- inequívoco.
-- =========================================================

CREATE TABLE IF NOT EXISTS crons_corridas (
  -- El identificador del cron: 'avisar-ml', 'precios-sugeridos', etc.
  clave           TEXT PRIMARY KEY,
  ultima_corrida  TIMESTAMPTZ NOT NULL,
  -- Qué devolvió la última vez. Sirve para distinguir "no corrió" de "corrió
  -- y salió mal", que se arreglan de maneras distintas.
  ultimo_ok       BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_detalle  TEXT NULL
);

-- Una fila por cron, siempre pisada: sólo importa la última vez. El historial
-- completo ya está en los runs de GitHub Actions; duplicarlo acá sería una
-- tabla que crece para siempre y que nadie consulta.

ALTER TABLE crons_corridas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role administra latidos de crons" ON crons_corridas;
CREATE POLICY "service role administra latidos de crons"
  ON crons_corridas FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
