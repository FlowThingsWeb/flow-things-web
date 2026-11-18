-- =========================================================
-- Flow Things — Recuperación de carrito abandonado
-- Ejecutar en Supabase: SQL Editor → New Query → Run
-- =========================================================

-- Marca cuándo se envió el email de recordatorio (NULL = pendiente / re-armado).
ALTER TABLE carritos_guardados
  ADD COLUMN IF NOT EXISTS recordatorio_enviado TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS carritos_recordatorio_idx
  ON carritos_guardados(recordatorio_enviado, updated_at);
