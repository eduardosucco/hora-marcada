-- Garante um slug válido para novos prestadores criados pelo fluxo atual.
create or replace function public.hm_set_provider_slug()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := 'provider-' || substr(new.id::text, 1, 8);
  end if;
  return new;
end;
$$;

drop trigger if exists hm_provider_slug_default on public.hm_providers;
create trigger hm_provider_slug_default
before insert on public.hm_providers
for each row execute function public.hm_set_provider_slug();
