-- Tabla de direcciones guardadas por usuario
-- Ejecutar en Supabase → SQL Editor

CREATE TABLE IF NOT EXISTS direcciones_guardadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  etiqueta TEXT NOT NULL DEFAULT 'Casa',       -- Casa, Trabajo, etc.
  direccion TEXT NOT NULL,
  ciudad TEXT NOT NULL,
  provincia TEXT NOT NULL,
  codigo_postal TEXT NOT NULL DEFAULT '',
  es_principal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice por usuario
CREATE INDEX IF NOT EXISTS idx_direcciones_user_id ON direcciones_guardadas(user_id);

-- RLS
ALTER TABLE direcciones_guardadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios ven sus propias direcciones"
  ON direcciones_guardadas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios crean sus propias direcciones"
  ON direcciones_guardadas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuarios actualizan sus propias direcciones"
  ON direcciones_guardadas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuarios eliminan sus propias direcciones"
  ON direcciones_guardadas FOR DELETE
  USING (auth.uid() = user_id);
