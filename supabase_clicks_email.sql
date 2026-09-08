-- =========================================================
-- Clicks de los mails de difusión.
--
-- Los mails salen por SMTP de Gmail, que no reescribe links ni mete pixel: no
-- hay forma de que el proveedor cuente nada. Y GA4 sólo ve al que además
-- CARGÓ la página — el que clickea y cierra antes no aparece en ningún lado.
--
-- Esta tabla es el conteo propio: cada link del mail pasa por /r, que anota y
-- redirige. Es el número exacto, sin depender de que el visitante acepte
-- cookies ni de que llegue a cargar el sitio.
-- =========================================================

CREATE TABLE IF NOT EXISTS clicks_email (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Qué difusión. Coincide con el utm_campaign del link.
  campana     TEXT NOT NULL,
  -- A dónde iba. Sirve para saber QUÉ producto del mail tiró.
  destino     TEXT NOT NULL,
  -- Etiqueta opcional del link dentro del mail: 'producto', 'cta', 'logo'.
  posicion    TEXT NULL,
  user_agent  TEXT NULL,
  referer     TEXT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La consulta es siempre "cuántos clicks tuvo esta campaña, y en qué".
CREATE INDEX IF NOT EXISTS clicks_email_campana_idx
  ON clicks_email (campana, created_at DESC);

/**
 * A propósito NO se guarda la IP ni el email del destinatario.
 *
 * Para decidir si un mail funcionó alcanza con cuántos clicks tuvo y en qué
 * links; saber quién clickeó no cambia ninguna decisión y convierte una tabla
 * de métricas en una de datos personales. Si algún día hace falta segmentar,
 * se agrega un token por destinatario y se piensa el consentimiento entonces.
 */

ALTER TABLE clicks_email ENABLE ROW LEVEL SECURITY;

-- Sólo el service role escribe (lo hace /r) y lee (el panel).
DROP POLICY IF EXISTS "service role administra clicks de email" ON clicks_email;
CREATE POLICY "service role administra clicks de email"
  ON clicks_email FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
