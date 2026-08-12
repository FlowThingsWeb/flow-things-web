-- =====================================================================
-- Log de emails enviados: registra cada mail que sale por sendEmail, para
-- poder mostrar el historial por usuario en el admin.
-- Solo el service role escribe/lee (RLS sin policies bloquea al público).
-- =====================================================================

create table if not exists public.emails_enviados (
  id uuid primary key default gen_random_uuid(),
  destinatario text not null,
  asunto text,
  created_at timestamptz not null default now()
);

create index if not exists emails_enviados_destinatario_idx
  on public.emails_enviados (lower(destinatario), created_at desc);

alter table public.emails_enviados enable row level security;

comment on table public.emails_enviados is
  'Log de emails salientes (destinatario + asunto + fecha). Alimenta el historial de usuario.';
