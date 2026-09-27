-- =========================================================
-- Flow Things — Checkouts en progreso (carrito + email, sin pagar)
-- Ejecutar en Supabase: SQL Editor → New Query → Run
-- =========================================================
--
-- Por qué una tabla aparte y no una orden en estado "borrador":
--
-- `ordenes` significa "alguien apretó Pagar". La miran el listado de órdenes
-- del admin, el contador del panel, los destinatarios del broadcast, el sync
-- al CRM y la página de la cuenta del cliente. Meter ahí un borrador que se
-- crea mientras el visitante todavía está escribiendo ensuciaría las seis
-- pantallas, y varias hablan de plata.
--
-- Esto es otra cosa: alguien que dejó su email en el checkout y no terminó.
-- Vive acá, no cuenta como venta y no aparece donde se cuentan ventas.
--
-- Un registro por email: el mismo comprador que vuelve y cambia el carrito
-- pisa su propia fila en vez de acumular una por visita.

CREATE TABLE IF NOT EXISTS checkouts_en_progreso (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Siempre en minúsculas: lo normaliza `guardarCheckoutEnProgreso` antes de
  -- escribir. Va así y no con un índice sobre lower(email) porque el upsert
  -- necesita una restricción única sobre LA COLUMNA; contra un índice de
  -- expresión, `ON CONFLICT (email)` no matchea y cada visita insertaría una
  -- fila nueva.
  email         TEXT NOT NULL UNIQUE,
  nombre        TEXT,
  telefono      TEXT,
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  total         NUMERIC NOT NULL DEFAULT 0,
  -- Si estaba logueado. Null para invitados, que son la mayoría.
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Misma secuencia que carritos_guardados: 2 horas, un día, una semana.
  recordatorio_2h_at  TIMESTAMPTZ,
  recordatorio_24h_at TIMESTAMPTZ,
  recordatorio_7d_at  TIMESTAMPTZ,
  -- Terminó comprando: deja de ser candidato a recordatorio para siempre.
  convertido_at TIMESTAMPTZ
);

-- El índice que usa el cron: sólo los que siguen sin comprar.
CREATE INDEX IF NOT EXISTS checkouts_en_progreso_pendientes_idx
  ON checkouts_en_progreso (updated_at)
  WHERE convertido_at IS NULL;

-- RLS prendida y SIN políticas, a propósito.
--
-- Acá hay emails y teléfonos de gente que ni siquiera completó una compra. El
-- endpoint que escribe y el cron que lee usan la service_role key, que saltea
-- RLS. Sin políticas, la anon key del navegador no puede leer ni escribir
-- nada: ni la propia fila, ni la de otro.
ALTER TABLE checkouts_en_progreso ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE checkouts_en_progreso IS
  'Carrito + email de quien empezó el checkout y no pagó. No es una venta.';
COMMENT ON COLUMN checkouts_en_progreso.convertido_at IS
  'Cuándo terminó comprando. Con esto puesto no se le manda ningún recordatorio.';
