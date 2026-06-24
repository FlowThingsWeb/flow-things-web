-- Migración: agregar campos de facturación y dirección a la tabla perfiles
-- Ejecutar en Supabase → SQL Editor

ALTER TABLE perfiles
  ADD COLUMN IF NOT EXISTS dni TEXT,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS ciudad TEXT,
  ADD COLUMN IF NOT EXISTS provincia TEXT,
  ADD COLUMN IF NOT EXISTS codigo_postal TEXT;
