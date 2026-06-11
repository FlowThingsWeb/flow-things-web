-- ============================================================
-- FLOW THINGS — Tabla de configuración del sitio
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS configuracion (
  clave       VARCHAR(100) PRIMARY KEY,
  valor       TEXT,
  tipo        VARCHAR(20) DEFAULT 'text',  -- text | image | url
  etiqueta    VARCHAR(200),                -- nombre legible
  seccion     VARCHAR(100)                 -- general | hero | banners | footer
);

-- RLS
ALTER TABLE configuracion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read configuracion" ON configuracion;
CREATE POLICY "Public read configuracion"
  ON configuracion FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role all configuracion" ON configuracion;
CREATE POLICY "Service role all configuracion"
  ON configuracion
  USING (auth.role() = 'service_role');

-- Valores iniciales
INSERT INTO configuracion (clave, valor, tipo, etiqueta, seccion) VALUES
  ('sitio_nombre',          'Flow Things',                                    'text',  'Nombre del sitio',              'general'),
  ('logo_url',              '',                                               'image', 'Logo',                          'general'),
  ('hero_badge',            'Librería & Juguetería online',                   'text',  'Badge del hero',                'hero'),
  ('hero_titulo_1',         'Todo lo que',                                    'text',  'Título línea 1',                'hero'),
  ('hero_titulo_2',         'imaginás',                                       'text',  'Título línea 2 (resaltada)',     'hero'),
  ('hero_titulo_3',         'en un solo lugar',                               'text',  'Título línea 3',                'hero'),
  ('hero_subtitulo',        'Útiles, juguetes, libros y mucho más. Los mejores productos para aprender, crear y jugar, con envío a todo el país.', 'text', 'Subtítulo del hero', 'hero'),
  ('hero_cta_primario',     'Ver catálogo completo',                          'text',  'Botón primario',                'hero'),
  ('hero_cta_secundario',   'Explorar juguetería',                            'text',  'Botón secundario',              'hero'),
  ('hero_banner_url',       '/banner.png',                                    'image', 'Imagen del hero',               'hero'),
  ('mp_titulo',             'Pagá como quieras 💳',                           'text',  'Título banner de pago',         'banners'),
  ('mp_texto',              'Aceptamos todas las tarjetas y transferencia bancaria a través de Mercado Pago.', 'text', 'Texto banner de pago', 'banners'),
  ('footer_tagline',        'Tu librería y juguetería de confianza.',          'text',  'Tagline del footer',           'footer'),
  ('footer_instagram',      'https://instagram.com/flowthings',               'url',   'Link de Instagram',            'footer')
ON CONFLICT (clave) DO NOTHING;
