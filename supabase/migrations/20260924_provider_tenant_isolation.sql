-- Aplicada no projeto Supabase hora-marcada em 2026-09-24.
-- Prestadores autenticados por e-mail enxergam somente o próprio tenant.
-- Clientes autenticados por telefone mantêm acesso apenas ao que as policies específicas permitem.

drop policy if exists provider_read on public.hm_providers;
create policy provider_read on public.hm_providers
for select to authenticated
using (
  id = (select auth.uid())
  or coalesce((select (auth.jwt()->>'phone')), '') <> ''
);

drop policy if exists service_read on public.hm_services;
create policy service_read on public.hm_services
for select to authenticated
using (
  provider_id = (select auth.uid())
  or (
    coalesce((select (auth.jwt()->>'phone')), '') <> ''
    and active = true
  )
);

drop policy if exists slots_read on public.hm_busy_slots;
create policy slots_read on public.hm_busy_slots
for select to authenticated
using (
  provider_id = (select auth.uid())
  or coalesce((select (auth.jwt()->>'phone')), '') <> ''
);
