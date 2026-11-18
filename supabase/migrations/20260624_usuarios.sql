-- =========================================================
-- Flow Things — Sistema de Usuarios
-- Ejecutar en Supabase: SQL Editor → New Query → Run
-- =========================================================

-- 1. Perfiles de usuario (datos adicionales a auth.users)
CREATE TABLE IF NOT EXISTS perfiles (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nombre TEXT,
  telefono TEXT,
  primer_compra_usada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Favoritos
CREATE TABLE IF NOT EXISTS favoritos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, producto_id)
);

-- 3. Carritos guardados (para sync al hacer login)
CREATE TABLE IF NOT EXISTS carritos_guardados (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  items JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Columna user_id en ordenes (para historial de compras por usuario)
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS ordenes_user_id_idx ON ordenes(user_id);

-- ─── Row Level Security ────────────────────────────────────────────────────

ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favoritos ENABLE ROW LEVEL SECURITY;
ALTER TABLE carritos_guardados ENABLE ROW LEVEL SECURITY;

-- Perfiles: cada usuario ve y edita solo el suyo
CREATE POLICY "perfiles_own" ON perfiles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Favoritos: cada usuario ve y edita solo los suyos
CREATE POLICY "favoritos_own" ON favoritos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Carritos: cada usuario ve y edita solo el suyo
CREATE POLICY "carritos_guardados_own" ON carritos_guardados
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── Función helper: upsert carrito ───────────────────────────────────────
CREATE OR REPLACE FUNCTION upsert_carrito(p_user_id UUID, p_items JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO carritos_guardados (user_id, items, updated_at)
  VALUES (p_user_id, p_items, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET items = p_items, updated_at = NOW();
END;
$$;

-- ─── Notas de configuración ───────────────────────────────────────────────
-- Para habilitar registro de usuarios, en Supabase Dashboard:
--   Authentication → Settings → Email → "Confirm email" (podés desactivarlo para dev)
--   O configurar el Site URL y Redirect URLs para que funcione la confirmación
