-- =========================================================
-- El precio de cada producto ANTES de la promo.
--
-- La promo se hace en dos movimientos: primero se sube el precio de lista y
-- después se aplica el descuento sobre ese precio. Hecho sin red, el precio
-- original se pierde en el primer movimiento: cuando la promo termina, el
-- "precio de antes" que quedó guardado en productos.precio_anterior es el
-- inflado, y restaurar deja la tienda más cara de lo que empezó.
--
-- Esta tabla guarda el número con el que arrancó cada producto, una sola vez,
-- antes de tocar nada. Restaurar es volver a ese número, no deshacer una
-- cuenta — una cuenta se puede deshacer mal (×1,15 y después ÷1,15 no vuelve
-- al mismo peso por el redondeo), y un respaldo no.
--
-- Es también el registro de qué se hizo y cuándo: a qué precio estaba, a
-- cuánto se infló, a cuánto se ofertó. Sin eso, "¿a cuánto lo teníamos antes
-- del Cyber?" no tiene respuesta dos semanas después.
-- =========================================================

CREATE TABLE IF NOT EXISTS cyber_precios (
  producto_id      UUID PRIMARY KEY REFERENCES productos(id) ON DELETE CASCADE,
  -- Redundante con productos.sku a propósito: si el producto se borra, el
  -- registro de lo que se le hizo al precio sobrevive con su nombre puesto.
  sku              TEXT NULL,
  nombre           TEXT NULL,
  -- El precio con el que arrancó. Es lo único que no se puede recalcular.
  precio_original  NUMERIC NOT NULL,
  -- Los dos pasos, para poder mirar después qué pasó.
  precio_inflado   NUMERIC NULL,
  precio_oferta    NUMERIC NULL,
  inflado_at       TIMESTAMPTZ NULL,
  aplicado_at      TIMESTAMPTZ NULL,
  -- Cuando se restaura no se borra la fila: queda la historia de la promo.
  restaurado_at    TIMESTAMPTZ NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La consulta del panel es siempre "qué está tocado ahora mismo".
CREATE INDEX IF NOT EXISTS cyber_precios_vigentes_idx
  ON cyber_precios (restaurado_at)
  WHERE restaurado_at IS NULL;

ALTER TABLE cyber_precios ENABLE ROW LEVEL SECURITY;

-- Sólo el service role: lo escribe el panel de administración y no hay un solo
-- caso en que el comprador necesite leer esto.
DROP POLICY IF EXISTS "service role administra los precios del cyber" ON cyber_precios;
CREATE POLICY "service role administra los precios del cyber"
  ON cyber_precios FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Control: después de correr esto tiene que decir 0 filas.
SELECT COUNT(*) AS filas_en_cyber_precios FROM cyber_precios;
