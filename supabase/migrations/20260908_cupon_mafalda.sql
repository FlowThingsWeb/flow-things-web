-- =========================================================
-- MAFALDA5 — 5% por el lanzamiento de la línea Mafalda.
--
-- OJO con el alcance: la tabla de códigos no tiene forma de limitar un
-- descuento a una marca o a un producto, así que este 5% se aplica sobre el
-- carrito ENTERO, no sólo sobre lo de Mafalda. Es el comportamiento de todos
-- los códigos de la tienda; se aclara acá porque el mail lo anuncia como
-- "descuento en la línea Mafalda" y alguien puede usarlo para otra cosa.
--
-- Sin `usos_maximos` ni `un_uso_por_usuario`: es un código de difusión, la
-- gracia es que circule. Si se quiere acotar:
--   usos_maximos = 200          → se apaga solo a los 200 usos
--   un_uso_por_usuario = true   → uno por cuenta
--
-- Sin vencimiento. Para que caduque, poner fecha_vencimiento = '2026-10-31'.
-- =========================================================

INSERT INTO codigos_descuento (codigo, descripcion, tipo, valor, activo, usos_maximos, un_uso_por_usuario)
VALUES (
  'MAFALDA5',
  '5% por el lanzamiento de la línea Mafalda. Difusión por newsletter.',
  'porcentaje', 5, true, NULL, false
)
ON CONFLICT (codigo) DO UPDATE
  SET tipo = 'porcentaje',
      valor = 5,
      activo = true,
      descripcion = EXCLUDED.descripcion;
