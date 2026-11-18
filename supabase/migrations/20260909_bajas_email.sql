-- =========================================================
-- Bajas de las difusiones.
--
-- Hasta ahora los mails de difusión no tenían salida: ni link de baja en el
-- cuerpo ni encabezado List-Unsubscribe. Sin una salida visible la gente no se
-- da de baja, marca spam — que para Gmail es la peor señal que puede recibir un
-- remitente, y arrastra la entrega de TODOS los mails del dominio, incluidos
-- los transaccionales: confirmaciones de pedido, facturas, avisos de envío.
--
-- Además la Ley 25.326 (art. 27) da derecho a ser retirado de una base de
-- marketing directo y exige que cada comunicación diga cómo ejercerlo.
--
-- La lista es de exclusión, no de borrado: el usuario sigue existiendo y sigue
-- recibiendo lo transaccional —que pidió al comprar— y deja de recibir
-- difusiones. Borrar la cuenta perdería el historial de compras.
-- =========================================================

CREATE TABLE IF NOT EXISTS bajas_email (
  email       TEXT PRIMARY KEY,
  -- 'link' (botón del mail), 'un_click' (botón de Gmail), 'manual' (panel).
  motivo      TEXT NOT NULL DEFAULT 'link',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- El email es la clave primaria: darse de baja dos veces no es un error, es la
-- misma baja. Por eso los inserts van con ON CONFLICT DO NOTHING y el endpoint
-- puede contestar lo mismo siempre, sin revelar si la dirección ya estaba.

ALTER TABLE bajas_email ENABLE ROW LEVEL SECURITY;

-- Sólo el service role: escribe /baja y lee el broadcast antes de encolar.
DROP POLICY IF EXISTS "service role administra bajas de email" ON bajas_email;
CREATE POLICY "service role administra bajas de email"
  ON bajas_email FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
