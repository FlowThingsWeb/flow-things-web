-- =====================================================================
-- Subcategorías: el segundo nivel del catálogo.
--
-- Hasta ahora "Juguetería" era una bolsa de 91 productos: peluches, slime,
-- masas, gemas y sets de maquillaje mezclados en la misma grilla de 24 por
-- página. Quien entra buscando un peluche tiene que pasar cuatro páginas.
--
-- El árbol queda en dos niveles: categoría (Juguetería, Librería) →
-- subcategoría (Peluches, Slime, Cartucheras…). Una tabla y no una columna de
-- texto porque el menú necesita nombre, orden y slug propios, y porque así
-- renombrar "Maquillaje y cosmética" es un UPDATE y no tocar 18 productos.
--
-- Se siembran también subcategorías de Librería que hoy no tienen productos
-- (carpetas, cuadernos, mochilas). El menú esconde las vacías, así que no
-- molestan, y el día que entre la primera carpeta ya tiene dónde ir.
-- =====================================================================

create table if not exists public.subcategorias (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.categorias(id) on delete cascade,
  nombre text not null,
  slug text not null,
  -- Para ordenar el menú a mano: primero lo que más se busca, no alfabético.
  orden integer not null default 100,
  created_at timestamptz not null default now(),
  -- El slug es único DENTRO de la categoría, no en toda la tabla: mañana
  -- puede haber "sets" en juguetería y en librería sin pisarse.
  unique (categoria_id, slug)
);

create index if not exists subcategorias_categoria_idx
  on public.subcategorias (categoria_id, orden);

alter table public.productos
  add column if not exists subcategoria_id uuid
  references public.subcategorias(id) on delete set null;

create index if not exists productos_subcategoria_idx
  on public.productos (subcategoria_id);

comment on table public.subcategorias is
  'Segundo nivel del catálogo: Juguetería → Peluches, Librería → Cartucheras.';
comment on column public.productos.subcategoria_id is
  'Subcategoría dentro de la categoría del producto. Null = sin clasificar.';

-- ---- Lectura pública (el catálogo lo consume anónimo) ----
alter table public.subcategorias enable row level security;

drop policy if exists "subcategorias lectura publica" on public.subcategorias;
create policy "subcategorias lectura publica"
  on public.subcategorias for select
  using (true);

-- ---- Semilla ----
-- El `orden` refleja qué se busca más, no el alfabeto.
insert into public.subcategorias (categoria_id, nombre, slug, orden)
select c.id, s.nombre, s.slug, s.orden
from public.categorias c
join (values
  ('jugueteria', 'Peluches',                 'peluches',               10),
  ('jugueteria', 'Maquillaje y cosmética',   'maquillaje-y-cosmetica', 20),
  ('jugueteria', 'Peinado y estilismo',      'peinado-y-estilismo',    30),
  ('jugueteria', 'Slime',                    'slime',                  40),
  ('jugueteria', 'Masas y plastilinas',      'masas-y-plastilinas',    50),
  ('jugueteria', 'Arena mágica',             'arena-magica',           60),
  ('jugueteria', 'Manualidades y arte',      'manualidades-y-arte',    70),
  ('jugueteria', 'Dinosaurios y arqueología','dinos-y-arqueologia',    80),
  ('jugueteria', 'Muñecos y figuras',        'munecos-y-figuras',      90),
  ('jugueteria', 'Juego de roles',           'juego-de-roles',        100),
  ('jugueteria', 'Juguetes de baño',         'juguetes-de-bano',      110),
  ('libreria',   'Cartucheras y canoplas',   'cartucheras-y-canoplas', 10),
  ('libreria',   'Carpetas',                 'carpetas',               20),
  ('libreria',   'Cuadernos y repuestos',    'cuadernos',              30),
  ('libreria',   'Mochilas',                 'mochilas',               40),
  ('libreria',   'Útiles escolares',         'utiles-escolares',       50)
) as s(cat_slug, nombre, slug, orden) on s.cat_slug = c.slug
on conflict (categoria_id, slug) do update
  set nombre = excluded.nombre, orden = excluded.orden;

-- ---- Clasificación de lo que ya está cargado ----
-- Una sentencia por subcategoría, en orden de prioridad: cada una sólo toca
-- lo que quedó sin clasificar, así el primer patrón que engancha gana.
--
-- El orden importa en tres casos concretos:
--   - "Puzzle DE BAÑO" es juguete de baño, no manualidad.
--   - "Slime Cápsula Dino" es slime, no dinosaurio.
--   - "Influencer ESTILISTA" es peinado, no maquillaje.
do $$
declare
  regla record;
begin
  for regla in
    select * from (values
      ('jugueteria', 'juguetes-de-bano',       'DE BAÑO|DE BANO',                                     1),
      ('jugueteria', 'peluches',               'AIRBRUSH PLUSH',                                      2),
      ('jugueteria', 'slime',                  'SLIME',                                               3),
      ('jugueteria', 'arena-magica',           'ARENA MAGICA|ARENA MÁGICA',                           4),
      ('jugueteria', 'masas-y-plastilinas',    'MASA INTELIGENTE|MASA ESPONJOSA',                     5),
      ('jugueteria', 'dinos-y-arqueologia',    'DINOART|JURASIC|JURASSIC|PALEO|FOSSILS|T-REX MULTI',  6),
      ('jugueteria', 'munecos-y-figuras',      'MUÑECO SUPER ELASTICO|MUNECO SUPER ELASTICO',         7),
      ('jugueteria', 'juego-de-roles',         'SET VETERINARIA',                                     8),
      ('jugueteria', 'peinado-y-estilismo',    'ESTILISTA',                                           9),
      ('jugueteria', 'maquillaje-y-cosmetica',
         'DREAMS|GIRL BOSS|HEY BEAUTY|HEY! BEAUTY|INFLUENCER|^UNICORNIO|COSMETICA|COSMÉTICA|MAQUILLAJE|UÑAS|UNAS', 10),
      ('jugueteria', 'manualidades-y-arte',
         'GEMAS AUTOADHESIVAS|SWEET FRIENDS|MAGICAL WORLD|DIY |FUN BOX|PAINTING KIT|COLOREAR|PUZZLE', 11),
      ('libreria',   'cartucheras-y-canoplas', 'CANOPLA|CARTUCHERA',                                 12)
    ) as t(cat_slug, sub_slug, patron, prioridad)
    order by prioridad
  loop
    update public.productos p
    set subcategoria_id = s.id
    from public.subcategorias s
    join public.categorias c on c.id = s.categoria_id
    where s.slug = regla.sub_slug
      and c.slug = regla.cat_slug
      and p.categoria_id = c.id
      and p.subcategoria_id is null
      and upper(p.nombre) ~ regla.patron;
  end loop;
end $$;

-- Cuántos quedaron sin clasificar, para verlo al correr esto.
do $$
declare
  sin_clasificar integer;
begin
  select count(*) into sin_clasificar
  from public.productos p
  join public.categorias c on c.id = p.categoria_id
  where p.activo and p.subcategoria_id is null and c.slug in ('jugueteria', 'libreria');
  raise notice 'Productos activos sin subcategoría: %', sin_clasificar;
end $$;
