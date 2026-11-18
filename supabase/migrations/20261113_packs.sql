-- =====================================================================
-- Packs: un producto de la tienda que por dentro son varios productos.
--
-- La composición vivía en el CRM, que era el único que la usaba: abría el
-- pack al registrar la venta y calculaba su stock. Pero las dos decisiones
-- que tiene un pack —qué trae y a cuánto se vende— son de tienda, y se
-- tomaban en una pantalla donde no se ve la ficha ni la foto.
--
-- Acá el pack ES un producto: tiene su SKU, su precio, su stock y su ficha
-- como cualquier otro. Lo único que agrega esta tabla es de qué está hecho.
--
-- El stock del pack NO se carga: es una cuenta —cuántas cajas permite armar
-- el componente más escaso— y se recalcula sola cada vez que entra stock
-- del CRM o se edita la composición (ver lib/packs.ts).
-- =====================================================================

create table if not exists public.items_pack (
  id            uuid primary key default gen_random_uuid(),
  pack_id       uuid not null references public.productos(id) on delete cascade,
  componente_id uuid not null references public.productos(id) on delete restrict,
  cantidad      integer not null default 1 check (cantidad > 0),
  -- Precio de lista del componente el día que se armó el pack. Es lo que se
  -- usa para repartir el precio del pack entre sus partes cuando se informa
  -- la venta al CRM, y se guarda acá —no se lee del producto— para que una
  -- venta vieja siga repartida como se vendió aunque después cambien los
  -- precios.
  precio_lista  numeric(12,2) not null check (precio_lista >= 0),
  created_at    timestamptz not null default now(),
  unique (pack_id, componente_id),
  -- Un pack que se contiene a sí mismo es un stock infinito y una venta que
  -- no se puede abrir.
  check (pack_id <> componente_id)
);

create index if not exists items_pack_componente_idx
  on public.items_pack (componente_id);

alter table public.items_pack enable row level security;

-- Nadie lee esto desde el navegador: la ficha del pack no muestra de qué
-- está hecho (eso lo cuenta la descripción) y todo lo que lo usa —el push de
-- stock, el aviso de venta al CRM y el panel de admin— corre en el servidor
-- con la service_role.
drop policy if exists items_pack_service on public.items_pack;
create policy items_pack_service on public.items_pack
  for all to service_role using (true) with check (true);

-- ========== Los cinco packs que ya se venden ==========
-- Se insertan por SKU y no por id: los ids de productos no son los mismos
-- que los del CRM, y así esto se puede volver a correr sin duplicar.
insert into public.items_pack (pack_id, componente_id, cantidad, precio_lista)
select p.id, c.id, v.cantidad, v.precio_lista
from (values
  ('PACK-VITRINA',            '86324',     1, 95900),
  ('PACK-VITRINA',            '86331',     1, 50600),
  ('PACK-VITRINA',            '86333',     1, 50600),
  ('PACK-VITRINA',            '86332',     1, 50600),
  ('PACK-STARRY-RIDE',        '86317',     1, 78500),
  ('PACK-STARRY-RIDE',        '86318',     1, 78500),
  ('PACK-STARRY-RIDE',        '86316',     1, 78500),
  ('PACK-DUO-ROSA',           '86322',     1, 95900),
  ('PACK-DUO-ROSA',           '86320',     1, 95900),
  ('PACK-COCINA-GARFIELD',    '86819',     1, 40100),
  ('PACK-COCINA-GARFIELD',    '86807',     1, 79900),
  ('PACK-COCINA-GARFIELD',    '86808',     1, 95900),
  ('PACK-ESCRITORIO-MAFALDA', '4722-20',   1, 73300),
  ('PACK-ESCRITORIO-MAFALDA', '4760-11TD', 1, 38300),
  ('PACK-ESCRITORIO-MAFALDA', '4763-15TD', 1, 22000),
  ('PACK-ESCRITORIO-MAFALDA', '4767-15TD', 1, 15600)
) as v(pack_sku, componente_sku, cantidad, precio_lista)
join public.productos p on p.sku = v.pack_sku
join public.productos c on c.sku = v.componente_sku
on conflict (pack_id, componente_id) do nothing;
