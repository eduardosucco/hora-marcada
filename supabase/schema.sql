-- Hora Marcada: aplicar no novo projeto selecionado pelo proprietário.
create extension if not exists btree_gist;
create table public.hm_providers(id uuid primary key references auth.users(id),name text not null check(length(trim(name)) between 1 and 100));
create table public.hm_services(id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.hm_providers(id),name text not null check(length(trim(name)) between 1 and 100),duration integer not null check(duration between 15 and 480 and duration%15=0),price numeric(12,2) not null check(price>=0),color text not null default 'mint',active boolean not null default true,unique(id,provider_id));
create table public.hm_clients(id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.hm_providers(id),name text not null check(length(trim(name)) between 1 and 100),phone text not null check(phone ~ '^\+55[0-9]{10,11}$'),email text not null default '',unique(provider_id,phone),unique(id,provider_id));
create table public.hm_bookings(id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.hm_providers(id),client_id uuid not null,service_id uuid not null,starts_at timestamptz not null,ends_at timestamptz not null,status text not null default 'confirmado' check(status in ('confirmado','pendente','concluido','cancelado')),price numeric(12,2) not null check(price>=0),notes text not null default '' check(length(notes)<=500),foreign key(client_id,provider_id) references public.hm_clients(id,provider_id),foreign key(service_id,provider_id) references public.hm_services(id,provider_id),check(ends_at>starts_at),unique(id,provider_id),exclude using gist(provider_id with =,tstzrange(starts_at,ends_at,'[)') with &&) where(status<>'cancelado'));
create table public.hm_payments(id uuid primary key default gen_random_uuid(),provider_id uuid not null references public.hm_providers(id),booking_id uuid not null unique,amount numeric(12,2) not null check(amount>=0),method text not null check(method in ('Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência')),paid_at timestamptz not null default now(),foreign key(booking_id,provider_id) references public.hm_bookings(id,provider_id));
alter table public.hm_providers enable row level security;
alter table public.hm_services enable row level security;
alter table public.hm_clients enable row level security;
alter table public.hm_bookings enable row level security;
alter table public.hm_payments enable row level security;
grant select,insert,update on public.hm_providers,public.hm_services,public.hm_clients,public.hm_bookings to authenticated;
grant select,insert on public.hm_payments to authenticated;
revoke all on public.hm_providers,public.hm_services,public.hm_clients,public.hm_bookings,public.hm_payments from anon;
create policy provider_read on public.hm_providers for select to authenticated using(true);
create policy provider_create on public.hm_providers for insert to authenticated with check(id=(select auth.uid()) and coalesce((select auth.jwt()->>'email'),'')<>'');
create policy provider_update on public.hm_providers for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
create policy service_read on public.hm_services for select to authenticated using(true);
create policy service_create on public.hm_services for insert to authenticated with check(provider_id=(select auth.uid()));
create policy service_update on public.hm_services for update to authenticated using(provider_id=(select auth.uid())) with check(provider_id=(select auth.uid()));
create policy client_read on public.hm_clients for select to authenticated using(provider_id=(select auth.uid()) or phone='+'||(select auth.jwt()->>'phone'));
create policy client_create on public.hm_clients for insert to authenticated with check(provider_id=(select auth.uid()) or phone='+'||(select auth.jwt()->>'phone'));
create policy client_update on public.hm_clients for update to authenticated using(provider_id=(select auth.uid())) with check(provider_id=(select auth.uid()));
create policy booking_read on public.hm_bookings for select to authenticated using(provider_id=(select auth.uid()) or exists(select 1 from public.hm_clients c where c.id=client_id and c.phone='+'||(select auth.jwt()->>'phone')));
create policy booking_create on public.hm_bookings for insert to authenticated with check(provider_id=(select auth.uid()) or (status='confirmado' and exists(select 1 from public.hm_clients c where c.id=client_id and c.phone='+'||(select auth.jwt()->>'phone'))));
create policy booking_update on public.hm_bookings for update to authenticated using(provider_id=(select auth.uid()) or exists(select 1 from public.hm_clients c where c.id=client_id and c.phone='+'||(select auth.jwt()->>'phone'))) with check(provider_id=(select auth.uid()) or (status='cancelado' and exists(select 1 from public.hm_clients c where c.id=client_id and c.phone='+'||(select auth.jwt()->>'phone'))));
create policy payment_read on public.hm_payments for select to authenticated using(provider_id=(select auth.uid()) or exists(select 1 from public.hm_bookings b join public.hm_clients c on c.id=b.client_id where b.id=booking_id and c.phone='+'||(select auth.jwt()->>'phone')));
create policy payment_create on public.hm_payments for insert to authenticated with check(provider_id=(select auth.uid()));
create function public.hm_check_booking() returns trigger language plpgsql security invoker set search_path='' as $$
declare s public.hm_services;
begin
 if tg_op='UPDATE' then
  if row(new.id,new.provider_id,new.client_id,new.service_id,new.starts_at,new.ends_at,new.price) is distinct from row(old.id,old.provider_id,old.client_id,old.service_id,old.starts_at,old.ends_at,old.price) then raise exception 'Os dados do agendamento são imutáveis. Cancele e reserve novamente.'; end if;
  if old.status in ('concluido','cancelado') and new.status<>old.status then raise exception 'Atendimento já finalizado.'; end if;
  if auth.uid()<>old.provider_id and (new.status<>'cancelado' or new.notes<>old.notes) then raise exception 'Cliente pode somente cancelar.'; end if;
  return new;
 end if;
 select * into s from public.hm_services where id=new.service_id and provider_id=new.provider_id and active;
 if not found then raise exception 'Serviço indisponível.'; end if;
 if new.starts_at<=now() then raise exception 'Escolha um horário futuro.'; end if;
 new.ends_at:=new.starts_at+make_interval(mins=>s.duration);new.price:=s.price;
 if (new.starts_at at time zone 'America/Sao_Paulo')::time<'08:00' or (new.ends_at at time zone 'America/Sao_Paulo')::time>'18:00' or (new.starts_at at time zone 'America/Sao_Paulo')::date<>(new.ends_at at time zone 'America/Sao_Paulo')::date then raise exception 'Atendimentos disponíveis entre 08h e 18h.';end if;
 return new;
end $$;
create trigger hm_booking_validation before insert or update on public.hm_bookings for each row execute function public.hm_check_booking();
create function public.hm_check_payment() returns trigger language plpgsql security invoker set search_path='' as $$
declare b public.hm_bookings;
begin
 select * into b from public.hm_bookings where id=new.booking_id and provider_id=new.provider_id;
 if not found or b.status='cancelado' then raise exception 'Atendimento inválido.';end if;
 new.amount:=b.price;new.paid_at:=now();return new;
end $$;
create trigger hm_payment_validation before insert on public.hm_payments for each row execute function public.hm_check_payment();
-- Projeção de ocupação sem nome, telefone, serviço, valor ou ID de cliente.
create table public.hm_busy_slots(booking_id uuid primary key references public.hm_bookings(id),provider_id uuid not null references public.hm_providers(id),starts_at timestamptz not null,ends_at timestamptz not null);
alter table public.hm_busy_slots enable row level security;
grant select,insert,update,delete on public.hm_busy_slots to authenticated;
create policy slots_read on public.hm_busy_slots for select to authenticated using(true);
-- Só o gatilho pode modificar a projeção (trigger depth); identidade da reserva é validada por RLS.
create policy slots_insert on public.hm_busy_slots for insert to authenticated with check(pg_trigger_depth()>0 and exists(select 1 from public.hm_bookings b where b.id=booking_id and b.provider_id=hm_busy_slots.provider_id and b.starts_at=hm_busy_slots.starts_at and b.ends_at=hm_busy_slots.ends_at));
create policy slots_delete on public.hm_busy_slots for delete to authenticated using(pg_trigger_depth()>0 and exists(select 1 from public.hm_bookings b where b.id=booking_id and b.status='cancelado'));
create function public.hm_sync_slot() returns trigger language plpgsql security invoker set search_path='' as $$ begin
 if tg_op='INSERT' and new.status<>'cancelado' then insert into public.hm_busy_slots values(new.id,new.provider_id,new.starts_at,new.ends_at);elsif new.status='cancelado' then delete from public.hm_busy_slots where booking_id=new.id;end if;return new;end $$;
create trigger hm_slot_projection after insert or update on public.hm_bookings for each row execute function public.hm_sync_slot();
create index hm_clients_phone_idx on public.hm_clients(phone);
create index hm_bookings_client_idx on public.hm_bookings(client_id);
create index hm_bookings_service_idx on public.hm_bookings(service_id);
create index hm_payments_provider_idx on public.hm_payments(provider_id);
create index hm_busy_provider_idx on public.hm_busy_slots(provider_id,starts_at);

-- White-label por prestador. RLS existente permite alteração apenas pelo dono.
alter table public.hm_providers add column brand jsonb not null default '{"name":"Hora Marcada","tagline":"Seu tempo, bem cuidado","primary":"#176f56","secondary":"#647caa","segment":"Serviços"}'::jsonb;
alter table public.hm_providers add constraint hm_brand_valid check(jsonb_typeof(brand)='object' and brand ?& array['name','tagline','primary','secondary','segment'] and length(trim(brand->>'name')) between 1 and 40 and length(brand->>'tagline')<=70 and length(brand->>'segment')<=50 and (brand->>'primary') ~ '^#[0-9a-fA-F]{6}$' and (brand->>'secondary') ~ '^#[0-9a-fA-F]{6}$');
