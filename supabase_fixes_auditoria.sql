-- =========================================================
-- SQL de fixes de auditoría — ejecutar en Supabase SQL Editor
-- =========================================================

-- B-07: RPC atómica para incrementar usos de código de descuento
-- Evita race condition de read-then-write en webhooks concurrentes
CREATE OR REPLACE FUNCTION incrementar_uso_codigo(p_codigo text)
RETURNS TABLE(id uuid, un_uso_por_usuario boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE codigos_descuento
  SET usos_actuales = usos_actuales + 1
  WHERE codigo = p_codigo
  RETURNING codigos_descuento.id, codigos_descuento.un_uso_por_usuario;
END;
$$;
