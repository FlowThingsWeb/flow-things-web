-- =========================================================
-- Flow Things — Regalo de cumpleaños
-- Ejecutar en Supabase: SQL Editor → New Query → Run
-- =========================================================
--
-- La fecha de nacimiento ya vive en `perfiles` y el formulario de la cuenta ya
-- promete "te mandamos promociones especiales durante tu mes de cumpleaños".
-- Esto es lo que faltaba para cumplirlo.
--
-- Los códigos en sí van a `codigos_descuento`, que ya sabe vencer por fecha y
-- por cantidad de usos. Esta tabla es sólo el registro de a quién ya se le
-- mandó: sin ella, el cron diario le mandaría el mismo mail todos los días de
-- su mes de cumpleaños.

CREATE TABLE IF NOT EXISTS cumples_enviados (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Año calendario del envío. Una persona cumple una vez por año, así que
  -- esto es lo que hace que el regalo sea uno y no uno por día.
  anio       INTEGER NOT NULL,
  -- Mes en el que se mandó, para poder mirar el histórico sin cruzar tablas.
  mes        INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  -- El código que se le generó. Queda acá aunque después se borre de
  -- codigos_descuento, para saber qué se prometió.
  codigo     TEXT NOT NULL,
  -- Si lo terminó usando. Lo completa el cron la próxima vez que pasa.
  usado_at   TIMESTAMPTZ,
  enviado_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Un regalo por persona por año. Es la garantía de idempotencia del cron:
-- aunque corra veinte veces en el día, el insert falla y no se manda nada.
CREATE UNIQUE INDEX IF NOT EXISTS cumples_enviados_user_anio_idx
  ON cumples_enviados (user_id, anio);

-- RLS prendida y sin políticas: esto lo escribe y lo lee el cron con la
-- service_role. El navegador no tiene nada que hacer acá.
ALTER TABLE cumples_enviados ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE cumples_enviados IS
  'A quién se le mandó el regalo de cumpleaños y en qué año. Evita repetir.';
