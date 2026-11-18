-- ============================================================
-- FLOW THINGS — Setup completo de Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- TABLA: categorias
CREATE TABLE categorias (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO categorias (nombre, slug) VALUES
  ('Librería', 'libreria'),
  ('Juguetería', 'jugueteria'),
  ('Útiles Escolares', 'utiles-escolares'),
  ('Juegos de Mesa', 'juegos-de-mesa');

-- TABLA: productos
CREATE TABLE productos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  precio NUMERIC(10,2) NOT NULL,
  precio_anterior NUMERIC(10,2),
  stock INTEGER DEFAULT 0,
  categoria_id UUID REFERENCES categorias(id),
  imagen_url TEXT,
  imagenes TEXT[] DEFAULT '{}',
  activo BOOLEAN DEFAULT TRUE,
  destacado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TABLA: ordenes
CREATE TABLE ordenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mp_preference_id TEXT,
  mp_payment_id TEXT,
  estado TEXT DEFAULT 'pending' CHECK (estado IN ('pending','approved','rejected','cancelled','refunded')),
  total NUMERIC(10,2) NOT NULL,
  items JSONB NOT NULL,
  datos_comprador JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TRIGGER: auto-actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ordenes_updated_at
  BEFORE UPDATE ON ordenes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- FUNCIÓN: decrementar stock al aprobar pago
CREATE OR REPLACE FUNCTION decrementar_stock(p_producto_id UUID, p_cantidad INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE productos
  SET stock = GREATEST(0, stock - p_cantidad)
  WHERE id = p_producto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ÍNDICES
CREATE INDEX idx_productos_slug ON productos(slug);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_activo ON productos(activo);
CREATE INDEX idx_ordenes_mp_payment ON ordenes(mp_payment_id);
CREATE INDEX idx_ordenes_estado ON ordenes(estado);

-- ROW LEVEL SECURITY
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;

-- Lectura pública de productos activos
CREATE POLICY "Productos públicos visibles" ON productos
  FOR SELECT USING (activo = TRUE);

-- Lectura pública de categorías
CREATE POLICY "Categorías públicas" ON categorias
  FOR SELECT USING (TRUE);

-- Admin (service role) tiene acceso completo
CREATE POLICY "Admin full access productos" ON productos
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admin full access ordenes" ON ordenes
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- STORAGE: ejecutar luego de crear el bucket "productos"
-- ============================================================

-- Lectura pública
CREATE POLICY "Imágenes públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'productos');

-- Upload solo desde servidor (service role)
CREATE POLICY "Upload solo admin"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'productos');
