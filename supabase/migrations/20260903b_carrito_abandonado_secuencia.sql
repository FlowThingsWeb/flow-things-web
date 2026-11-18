-- =========================================================
-- Carrito abandonado: tres recordatorios en vez de uno.
--
-- Hasta ahora salía un solo mail entre la hora y las 48 horas, y ahí terminaba
-- el asunto: el que no compró en dos días no volvía a saber de nosotros.
-- Ahora son tres, a las 2 horas, al día y a la semana, y el de la semana lleva
-- un 5% de descuento.
--
-- Una columna por etapa y no un contador: así se sabe cuándo se mandó cada una
-- —sirve para mirar cuál convierte— y una etapa que ya salió no puede volver a
-- salir aunque el cron corra dos veces.
-- =========================================================

ALTER TABLE carritos_guardados
  ADD COLUMN IF NOT EXISTS recordatorio_2h_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recordatorio_24h_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recordatorio_7d_at  TIMESTAMPTZ;

COMMENT ON COLUMN carritos_guardados.recordatorio_2h_at IS
  'Primer aviso, a las 2 horas de abandonado.';
COMMENT ON COLUMN carritos_guardados.recordatorio_24h_at IS
  'Segundo aviso, al día.';
COMMENT ON COLUMN carritos_guardados.recordatorio_7d_at IS
  'Tercer aviso, a la semana. Es el que lleva el cupón de 5%.';

-- Los que ya recibieron el mail viejo cuentan como primera etapa cumplida: no
-- corresponde volver a mandarles el de las 2 horas por un carrito de la semana
-- pasada. Sí les va a llegar el del día y el de la semana si siguen sin comprar.
UPDATE carritos_guardados
SET recordatorio_2h_at = recordatorio_enviado
WHERE recordatorio_enviado IS NOT NULL
  AND recordatorio_2h_at IS NULL;

-- El cron busca por antigüedad del carrito y por etapas sin enviar.
CREATE INDEX IF NOT EXISTS carritos_recordatorios_idx
  ON carritos_guardados (updated_at)
  WHERE recordatorio_7d_at IS NULL;

-- =========================================================
-- El cupón del tercer mail.
--
-- `un_uso_por_usuario` es lo que lo hace de una sola vez: la validación ya
-- registra en descuentos_usos_usuario quién lo usó y rechaza el segundo
-- intento. Sin usos_maximos, porque el límite es por persona y no global.
-- =========================================================
INSERT INTO codigos_descuento (codigo, descripcion, tipo, valor, activo, usos_maximos, un_uso_por_usuario)
VALUES (
  'VOLVE5',
  '5% para carritos abandonados hace una semana. Una vez por usuario.',
  'porcentaje', 5, true, NULL, true
)
ON CONFLICT (codigo) DO UPDATE
  SET tipo = 'porcentaje',
      valor = 5,
      activo = true,
      un_uso_por_usuario = true,
      descripcion = EXCLUDED.descripcion;
