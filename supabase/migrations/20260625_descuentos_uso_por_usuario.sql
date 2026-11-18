-- Agregar columna "1 uso por usuario" a la tabla de códigos de descuento
ALTER TABLE codigos_descuento
  ADD COLUMN IF NOT EXISTS un_uso_por_usuario boolean NOT NULL DEFAULT false;

-- Tabla para registrar qué usuario usó qué código
CREATE TABLE IF NOT EXISTS descuentos_usos_usuario (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_id   uuid NOT NULL REFERENCES codigos_descuento(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (codigo_id, user_id)  -- un usuario solo puede usar cada código una vez
);

-- Índices para consulta rápida en validación
CREATE INDEX IF NOT EXISTS idx_descuentos_usos_codigo ON descuentos_usos_usuario(codigo_id);
CREATE INDEX IF NOT EXISTS idx_descuentos_usos_user   ON descuentos_usos_usuario(user_id);
