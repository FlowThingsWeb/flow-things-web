-- =========================================================
-- Flow Things — Reseñas de productos
-- Ejecutar en Supabase: SQL Editor → New Query → Run
-- =========================================================

-- 1. Tabla de reseñas (una por usuario por producto)
CREATE TABLE IF NOT EXISTS resenas (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nombre      TEXT,                                   -- nombre a mostrar (snapshot)
  rating      INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comentario  TEXT,
  aprobada    BOOLEAN DEFAULT TRUE,                   -- se auto-aprueba (solo compradores)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (producto_id, user_id)
);

CREATE INDEX IF NOT EXISTS resenas_producto_idx ON resenas(producto_id);

-- 2. Vista de agregados por producto (promedio + cantidad de aprobadas)
CREATE OR REPLACE VIEW producto_ratings AS
  SELECT producto_id,
         ROUND(AVG(rating)::numeric, 1) AS promedio,
         COUNT(*)                       AS cantidad
  FROM resenas
  WHERE aprobada
  GROUP BY producto_id;

-- ─── Row Level Security ────────────────────────────────────────────────────
-- Las escrituras se hacen SOLO desde el backend (service role) para poder
-- verificar que quien reseña efectivamente compró el producto. Por eso no hay
-- policy de INSERT para clientes: solo se permite leer las reseñas aprobadas.
ALTER TABLE resenas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resenas_read_aprobadas" ON resenas;
CREATE POLICY "resenas_read_aprobadas" ON resenas
  FOR SELECT
  USING (aprobada = TRUE);
