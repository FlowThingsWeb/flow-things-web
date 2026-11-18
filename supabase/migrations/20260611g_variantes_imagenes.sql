-- Agregar galería de imágenes a variantes
-- Ejecutar en Supabase > SQL Editor

ALTER TABLE variantes ADD COLUMN IF NOT EXISTS imagenes TEXT[] DEFAULT '{}';
