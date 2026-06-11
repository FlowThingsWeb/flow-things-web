-- Agregar imagen a variantes
-- Ejecutar en Supabase > SQL Editor

ALTER TABLE variantes ADD COLUMN IF NOT EXISTS imagen_url TEXT DEFAULT NULL;
