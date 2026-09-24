-- Área do cliente: URL por prestador + autenticação simples por telefone/PIN.
-- Aplicada no projeto Supabase em 2026-09-24.

alter table public.hm_providers
  add column if not exists slug text;

update public.hm_providers
set slug = 'provider-' || substr(id::text,1,8)
where slug is null or btrim(slug) = '';

update public.hm_providers p
set slug = 'hora-marcada'
from auth.users u
where u.id = p.id
  and lower(u.email) = lower('admin@horamarcada.com.br');

alter table public.hm_providers
  alter column slug set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'hm_providers_slug_format'
      and conrelid = 'public.hm_providers'::regclass
  ) then
    alter table public.hm_providers
      add constraint hm_providers_slug_format
      check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
  end if;
end $$;

create unique index if not exists hm_providers_slug_uidx
  on public.hm_providers(slug);

create table if not exists public.hm_client_credentials (
  client_id uuid primary key,
  provider_id uuid not null,
  pin_hash text not null,
  pin_salt text not null,
  iterations integer not null default 180000 check (iterations between 100000 and 1000000),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, provider_id)
    references public.hm_clients(id, provider_id)
    on delete cascade
);

create table if not exists public.hm_client_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  provider_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  foreign key (client_id, provider_id)
    references public.hm_clients(id, provider_id)
    on delete cascade
);

create index if not exists hm_client_credentials_provider_idx
  on public.hm_client_credentials(provider_id, client_id);

create index if not exists hm_client_sessions_lookup_idx
  on public.hm_client_sessions(token_hash, expires_at);

create index if not exists hm_client_sessions_client_idx
  on public.hm_client_sessions(provider_id, client_id);

alter table public.hm_client_credentials enable row level security;
alter table public.hm_client_sessions enable row level security;

revoke all on public.hm_client_credentials from anon, authenticated;
revoke all on public.hm_client_sessions from anon, authenticated;
