-- ============================================================
-- FLOW THINGS — Claves de configuración adicionales
-- Ejecutar en Supabase > SQL Editor (después de supabase_configuracion.sql)
-- ============================================================

INSERT INTO configuracion (clave, valor, tipo, etiqueta, seccion) VALUES
  -- Header
  ('header_nombre_1',        'FLOW',                        'text',  'Nombre parte 1 (ej: FLOW)',          'header'),
  ('header_nombre_2',        'THINGS',                      'text',  'Nombre parte 2 en color (ej: THINGS)','header'),
  ('header_nav_catalogo',    'Catálogo',                    'text',  'Nav: etiqueta Catálogo',              'header'),
  ('header_nav_libreria',    'Librería',                    'text',  'Nav: etiqueta Librería',              'header'),
  ('header_nav_jugueteria',  'Juguetería',                  'text',  'Nav: etiqueta Juguetería',            'header'),

  -- Secciones de la home
  ('seccion_categorias_titulo',  'Explorar por categoría',  'text',  'Título sección categorías',          'home'),
  ('seccion_destacados_titulo',  'Productos destacados',    'text',  'Título sección destacados',          'home'),
  ('seccion_ver_todos',          'Ver todos →',             'text',  'Link "Ver todos" en destacados',     'home'),

  -- Footer
  ('footer_tienda_titulo',   'Tienda',                      'text',  'Título columna Tienda',              'footer'),
  ('footer_contacto_titulo', 'Contacto',                    'text',  'Título columna Contacto',            'footer'),
  ('footer_email',           'contacto@flowthings.com.ar',  'text',  'Email de contacto',                  'footer'),
  ('footer_telefono',        '+54 9 11 5607 5633',          'text',  'Teléfono de contacto',               'footer'),
  ('footer_link_catalogo',   'Todo el catálogo',            'text',  'Link footer: Catálogo',              'footer'),
  ('footer_link_libreria',   'Librería',                    'text',  'Link footer: Librería',              'footer'),
  ('footer_link_jugueteria', 'Juguetería',                  'text',  'Link footer: Juguetería',            'footer'),
  ('footer_link_utiles',     'Útiles escolares',            'text',  'Link footer: Útiles',                'footer'),
  ('footer_banner_url',      '/banner.png',                 'image', 'Banner del footer',                  'footer'),
  ('footer_copyright',       'Todos los derechos reservados.','text','Texto de copyright',                 'footer')
ON CONFLICT (clave) DO NOTHING;
