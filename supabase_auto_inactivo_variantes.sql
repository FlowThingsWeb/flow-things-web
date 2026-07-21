-- =====================================================================
-- Auto-inactivar VARIANTES agotadas (complemento de
-- supabase_auto_inactivo_sin_stock.sql)
--
-- El catálogo arma una card por variante activa, así que una variante en
-- 0 seguía apareciendo con el cartel "Agotado" aunque el producto sí
-- tuviera stock en sus otras variantes.
--   Ej: "Masa Inteligente EXPERT PROFESSOR" → 6 colores, 5 con stock y
--       "Red Lava Glitter" en 0: el producto tiene stock, pero esa card
--       puntual no debería mostrarse.
--
-- Misma regla y misma salvaguarda que a nivel producto: se recuerda QUIÉN
-- desactivó, para no resucitar variantes que el admin apagó a mano.
--
-- Reutilizamos la función auto_activo_por_stock(): las columnas se llaman
-- igual en productos y en variantes, así que sirve para las dos tablas.
-- =====================================================================

alter table public.variantes
  add column if not exists desactivado_por_stock boolean not null default false;

comment on column public.variantes.desactivado_por_stock is
  'true = el sistema la desactivo por quedarse sin stock (se reactiva sola al reponer). false = estado manejado por el admin.';

drop trigger if exists trg_auto_activo_variante_por_stock on public.variantes;
create trigger trg_auto_activo_variante_por_stock
  before insert or update of stock, activo on public.variantes
  for each row
  execute function public.auto_activo_por_stock();

-- Backfill: ocultar las variantes que YA están agotadas y activas.
update public.variantes
set activo = false,
    desactivado_por_stock = true
where activo = true
  and stock <= 0;
