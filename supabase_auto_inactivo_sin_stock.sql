-- =====================================================================
-- Auto-inactivar productos agotados (y republicarlos al reponer stock)
--
-- Problema: un producto sin stock seguía apareciendo en el catálogo con
-- el cartel "Agotado", ensuciando la grilla.
--
-- Cuidado con pisar `activo` a lo bruto: `activo` significa "lo quiero
-- publicado" y lo maneja el admin a mano. Si al reponer stock
-- reactiváramos todo, resucitaríamos productos que el admin apagó a
-- propósito. Por eso guardamos QUIÉN lo desactivó:
--
--   desactivado_por_stock = true  → lo ocultó el sistema por falta de
--                                   stock; cuando vuelva stock, se
--                                   republica solo.
--   desactivado_por_stock = false → lo apagó el admin; el stock no lo
--                                   vuelve a prender nunca.
--
-- El stock del producto lo sincroniza el CRM (es la fuente de verdad),
-- así que este trigger se dispara solo con cada sync.
-- =====================================================================

alter table public.productos
  add column if not exists desactivado_por_stock boolean not null default false;

comment on column public.productos.desactivado_por_stock is
  'true = el sistema lo desactivo por quedarse sin stock (se reactiva solo al reponer). false = estado manejado por el admin.';

create or replace function public.auto_activo_por_stock()
returns trigger
language plpgsql
as $$
begin
  -- Se quedó sin stock estando publicado → ocultarlo y dejar la marca.
  if new.stock <= 0 and new.activo then
    new.activo := false;
    new.desactivado_por_stock := true;

  -- Volvió a haber stock y lo habíamos ocultado nosotros → republicar.
  elsif new.stock > 0 and not new.activo and new.desactivado_por_stock then
    new.activo := true;
    new.desactivado_por_stock := false;

  -- El admin lo reactivó a mano teniendo stock → deja de ser "nuestro".
  elsif new.stock > 0 and new.activo and new.desactivado_por_stock then
    new.desactivado_por_stock := false;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auto_activo_por_stock on public.productos;
create trigger trg_auto_activo_por_stock
  before insert or update of stock, activo on public.productos
  for each row
  execute function public.auto_activo_por_stock();

-- Backfill: ocultar los que YA están agotados y publicados.
update public.productos
set activo = false,
    desactivado_por_stock = true
where activo = true
  and stock <= 0;
