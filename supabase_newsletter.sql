-- =========================================================
-- Flow Things — Newsletter (suscriptores por email)
-- Ejecutar en Supabase: SQL Editor → New Query → Run
-- =========================================================

CREATE TABLE IF NOT EXISTS newsletter_suscriptores (
  email      TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escrituras solo desde el backend (service role). Sin policies de cliente.
ALTER TABLE newsletter_suscriptores ENABLE ROW LEVEL SECURITY;
