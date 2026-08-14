-- Descripción por variante (opcional). Se muestra en la ficha del producto
-- cuando se elige esa variante.
alter table public.variantes
  add column if not exists descripcion text;
