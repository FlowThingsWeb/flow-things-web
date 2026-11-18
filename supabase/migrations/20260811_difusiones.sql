-- =====================================================================
-- Difusiones (email marketing): campañas guardadas para reenviar.
-- Solo el service role (API admin) accede; RLS sin policies bloquea al
-- público.
-- =====================================================================

create table if not exists public.difusiones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  asunto text not null,
  cuerpo text not null default '',
  enviada_at timestamptz,               -- último envío
  destinatarios_count integer,          -- a cuántos se envió la última vez
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.difusiones enable row level security;
-- Sin policies a propósito: nadie del lado público puede leer/escribir.
-- La API admin usa el service role, que ignora RLS.

comment on table public.difusiones is
  'Campañas de email guardadas (difusiones). Gestionadas desde /admin/difusiones.';
