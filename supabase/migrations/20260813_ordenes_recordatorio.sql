-- =====================================================================
-- Recordatorio de checkout abandonado: marca cuándo se le envió el mail de
-- "terminá tu compra" a una orden pendiente, para no repetir.
-- =====================================================================

alter table public.ordenes
  add column if not exists recordatorio_carrito_at timestamptz;

comment on column public.ordenes.recordatorio_carrito_at is
  'Fecha en que se envió el mail de recuperación de checkout abandonado (orden pending).';
