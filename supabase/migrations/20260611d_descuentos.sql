-- ============================================================
-- FLOW THINGS — Tabla de códigos de descuento
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS codigos_descuento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          VARCHAR(50)  NOT NULL UNIQUE,
  descripcion     TEXT,
  tipo            VARCHAR(20)  NOT NULL CHECK (tipo IN ('porcentaje', 'monto_fijo')),
  valor           DECIMAL(10, 2) NOT NULL CHECK (valor > 0),
  activo          BOOLEAN      NOT NULL DEFAULT true,
  usos_maximos    INTEGER      NULL,         -- NULL = ilimitado
  usos_actuales   INTEGER      NOT NULL DEFAULT 0,
  fecha_vencimiento DATE       NULL,         -- NULL = sin vencimiento
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsqueda por código (case-sensitive, exacto)
CREATE INDEX IF NOT EXISTS idx_codigos_descuento_codigo ON codigos_descuento (codigo);

-- RLS
ALTER TABLE codigos_descuento ENABLE ROW LEVEL SECURITY;

-- Solo service_role puede leer/escribir (acceso total desde backend)
DROP POLICY IF EXISTS "Service role full access" ON codigos_descuento;
CREATE POLICY "Service role full access"
  ON codigos_descuento
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Agregar columna descuento_monto a ordenes si no existe
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS descuento_monto   DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_descuento  VARCHAR(50)    DEFAULT NULL;

-- Código de ejemplo para probar
INSERT INTO codigos_descuento (codigo, descripcion, tipo, valor, usos_maximos)
VALUES ('FLOWOFF10', '10% de descuento — código de prueba', 'porcentaje', 10, 100)
ON CONFLICT (codigo) DO NOTHING;
