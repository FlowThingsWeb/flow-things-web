-- ============================================================
-- FLOW THINGS — Actualización: SKU + Variantes
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- 1. Agregar SKU a productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku VARCHAR(100) UNIQUE;

-- 2. Tabla de variantes
CREATE TABLE IF NOT EXISTS variantes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id   UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  -- atributos: {"Color": "Rosa", "Talle": "M"}
  atributos     JSONB NOT NULL DEFAULT '{}',
  sku           VARCHAR(100) UNIQUE,
  stock         INTEGER NOT NULL DEFAULT 0,
  activo        BOOLEAN DEFAULT true,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_variantes_producto_id ON variantes(producto_id);

-- 3. RLS
ALTER TABLE variantes ENABLE ROW LEVEL SECURITY;

-- Lectura pública de variantes activas
DROP POLICY IF EXISTS "Public read active variantes" ON variantes;
CREATE POLICY "Public read active variantes"
  ON variantes FOR SELECT
  USING (activo = true);

-- Service role tiene acceso total
DROP POLICY IF EXISTS "Service role all variantes" ON variantes;
CREATE POLICY "Service role all variantes"
  ON variantes
  USING (auth.role() = 'service_role');

-- ============================================================
-- FUNCIÓN: decrementar stock de variante (para webhook MP)
-- ============================================================
CREATE OR REPLACE FUNCTION decrementar_stock_variante(variante_id UUID, cantidad INT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE variantes
  SET stock = GREATEST(0, stock - cantidad)
  WHERE id = variante_id;
END;
$$;
