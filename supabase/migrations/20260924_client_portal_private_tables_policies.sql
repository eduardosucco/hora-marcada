-- Explicit deny-all policies for client portal credential/session tables.
-- Edge Function uses the server-side Supabase secret key and bypasses RLS.

drop policy if exists hm_client_credentials_deny_api on public.hm_client_credentials;
create policy hm_client_credentials_deny_api
on public.hm_client_credentials
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists hm_client_sessions_deny_api on public.hm_client_sessions;
create policy hm_client_sessions_deny_api
on public.hm_client_sessions
for all
to anon, authenticated
using (false)
with check (false);
