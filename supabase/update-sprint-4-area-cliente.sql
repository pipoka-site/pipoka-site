-- PIPOKÁ Gourmet — Sprint 4: Área do Cliente
-- Execute depois das migrations das Sprints 1, 2 e 3.

create extension if not exists pgcrypto;

alter table public.orders add column if not exists customer_id uuid references auth.users(id) on delete set null;
create index if not exists orders_customer_id_created_at_idx on public.orders(customer_id, created_at desc);

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text unique not null,
  birth_date date,
  avatar_url text,
  marketing_opt_in boolean not null default false,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Casa',
  postal_code text not null default '',
  street text not null,
  number text not null,
  complement text,
  neighborhood text not null,
  city text not null,
  reference text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_addresses_user_idx on public.customer_addresses(user_id, is_default desc);

create table if not exists public.customer_favorites (
  user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id, product_id)
);

create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.customer_profiles(user_id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  admin_reply text,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_reviews_created_idx on public.customer_reviews(created_at desc);

create table if not exists public.customer_profile_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  changed_fields jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists customer_profile_changes_user_idx on public.customer_profile_changes(user_id, created_at desc);

create or replace function public.normalize_br_phone(value text)
returns text language sql immutable set search_path = '' as $$
  select case
    when regexp_replace(coalesce(value,''), '\D', '', 'g') = '' then ''
    when regexp_replace(value, '\D', '', 'g') like '55%' then '+' || regexp_replace(value, '\D', '', 'g')
    else '+55' || regexp_replace(value, '\D', '', 'g')
  end;
$$;

create or replace function public.handle_new_customer()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_phone text;
begin
  v_phone := public.normalize_br_phone(coalesce(new.raw_user_meta_data->>'phone',''));
  if v_phone = '' then return new; end if;
  insert into public.customer_profiles(user_id, full_name, email, phone)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''), lower(coalesce(new.email,'')), v_phone)
  on conflict(user_id) do update set email=excluded.email, full_name=excluded.full_name, phone=excluded.phone, updated_at=now();
  if coalesce(new.raw_user_meta_data->>'street','') <> '' and not exists(select 1 from public.customer_addresses where user_id=new.id) then
    insert into public.customer_addresses(user_id,label,postal_code,street,number,complement,neighborhood,city,reference,is_default)
    values(new.id,'Casa',coalesce(new.raw_user_meta_data->>'postal_code',''),new.raw_user_meta_data->>'street',coalesce(new.raw_user_meta_data->>'number',''),nullif(new.raw_user_meta_data->>'complement',''),coalesce(new.raw_user_meta_data->>'neighborhood',''),coalesce(new.raw_user_meta_data->>'city',''),nullif(new.raw_user_meta_data->>'reference',''),true);
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_customer_created on auth.users;
create trigger on_auth_customer_created after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_customer();

-- Cria perfil para usuários já existentes que tenham os metadados necessários.
insert into public.customer_profiles(user_id, full_name, email, phone)
select id, coalesce(raw_user_meta_data->>'full_name',''), lower(coalesce(email,'')), public.normalize_br_phone(raw_user_meta_data->>'phone')
from auth.users
where coalesce(raw_user_meta_data->>'phone','') <> ''
on conflict(user_id) do nothing;

create or replace function public.customer_login_email(p_phone text)
returns text language sql stable security definer set search_path = '' as $$
  select email from public.customer_profiles
  where phone = public.normalize_br_phone(p_phone)
  limit 1;
$$;
revoke all on function public.customer_login_email(text) from public;
grant execute on function public.customer_login_email(text) to anon, authenticated;

create or replace function public.touch_customer_login()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return false; end if;
  update public.customer_profiles set last_sign_in_at=now(), updated_at=now() where user_id=auth.uid();
  return true;
end;
$$;
revoke all on function public.touch_customer_login() from public, anon;
grant execute on function public.touch_customer_login() to authenticated;

create or replace function public.link_order_to_current_customer(p_order_code text, p_tracking_token text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_phone text;
begin
  if auth.uid() is null then return false; end if;
  select phone into v_phone from public.customer_profiles where user_id=auth.uid();
  update public.orders
  set customer_id=auth.uid()
  where order_code=p_order_code and tracking_token=p_tracking_token
    and public.normalize_br_phone(customer_phone)=v_phone;
  return found;
end;
$$;
revoke all on function public.link_order_to_current_customer(text,text) from public, anon;
grant execute on function public.link_order_to_current_customer(text,text) to authenticated;

-- Vincula pedidos antigos pelo telefone confirmado no perfil.
create or replace function public.link_previous_customer_orders()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_phone text; v_count integer;
begin
  if auth.uid() is null then return 0; end if;
  select phone into v_phone from public.customer_profiles where user_id=auth.uid();
  update public.orders set customer_id=auth.uid()
  where customer_id is null and public.normalize_br_phone(customer_phone)=v_phone;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.link_previous_customer_orders() from public, anon;
grant execute on function public.link_previous_customer_orders() to authenticated;

create or replace function public.audit_customer_profile_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare changes jsonb := '{}'::jsonb;
begin
  if old.full_name is distinct from new.full_name then changes := changes || jsonb_build_object('full_name',jsonb_build_object('old',old.full_name,'new',new.full_name)); end if;
  if old.phone is distinct from new.phone then changes := changes || jsonb_build_object('phone',jsonb_build_object('old',old.phone,'new',new.phone)); end if;
  if old.avatar_url is distinct from new.avatar_url then changes := changes || jsonb_build_object('avatar_url',jsonb_build_object('old',old.avatar_url,'new',new.avatar_url)); end if;
  if old.marketing_opt_in is distinct from new.marketing_opt_in then changes := changes || jsonb_build_object('marketing_opt_in',jsonb_build_object('old',old.marketing_opt_in,'new',new.marketing_opt_in)); end if;
  new.phone := public.normalize_br_phone(new.phone);
  new.updated_at := now();
  if changes <> '{}'::jsonb then insert into public.customer_profile_changes(user_id,changed_fields) values(new.user_id,changes); end if;
  return new;
end;
$$;
drop trigger if exists audit_customer_profile_change_trigger on public.customer_profiles;
create trigger audit_customer_profile_change_trigger before update on public.customer_profiles
for each row execute function public.audit_customer_profile_change();

create or replace function public.ensure_default_customer_address()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if new.is_default then update public.customer_addresses set is_default=false where user_id=new.user_id and id<>new.id; end if;
  return new;
end;
$$;
drop trigger if exists ensure_default_customer_address_trigger on public.customer_addresses;
create trigger ensure_default_customer_address_trigger before insert or update on public.customer_addresses
for each row execute function public.ensure_default_customer_address();

alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.customer_favorites enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.customer_profile_changes enable row level security;

-- Perfil: cliente vê/edita o próprio; administrador vê todos.
drop policy if exists "Customers read own profile" on public.customer_profiles;
create policy "Customers read own profile" on public.customer_profiles for select to authenticated
using (user_id=auth.uid() or (select private.is_admin()));
drop policy if exists "Customers update own profile" on public.customer_profiles;
create policy "Customers update own profile" on public.customer_profiles for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Endereços.
drop policy if exists "Customers manage own addresses" on public.customer_addresses;
create policy "Customers manage own addresses" on public.customer_addresses for all to authenticated
using (user_id=auth.uid() or (select private.is_admin()))
with check (user_id=auth.uid() or (select private.is_admin()));

-- Favoritos.
drop policy if exists "Customers manage own favorites" on public.customer_favorites;
create policy "Customers manage own favorites" on public.customer_favorites for all to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

-- Avaliações: somente pedido finalizado do próprio cliente.
drop policy if exists "Customers read own reviews" on public.customer_reviews;
create policy "Customers read own reviews" on public.customer_reviews for select to authenticated
using (user_id=auth.uid() or (select private.is_admin()));
drop policy if exists "Customers create own reviews" on public.customer_reviews;
create policy "Customers create own reviews" on public.customer_reviews for insert to authenticated
with check (user_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.customer_id=auth.uid() and o.status='completed'));
drop policy if exists "Customers update own reviews" on public.customer_reviews;
create policy "Customers update own reviews" on public.customer_reviews for update to authenticated
using (user_id=auth.uid() or (select private.is_admin()))
with check (user_id=auth.uid() or (select private.is_admin()));

-- Histórico de alterações: cliente e administrador podem ler, ninguém altera diretamente.
drop policy if exists "Customers read own profile changes" on public.customer_profile_changes;
create policy "Customers read own profile changes" on public.customer_profile_changes for select to authenticated
using (user_id=auth.uid() or (select private.is_admin()));

-- Pedidos próprios, preservando políticas administrativas existentes.
drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders" on public.orders for select to authenticated
using (customer_id=auth.uid() or (select private.is_admin()));

grant select, update on public.customer_profiles to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, insert, delete on public.customer_favorites to authenticated;
grant select, insert, update on public.customer_reviews to authenticated;
grant select on public.customer_profile_changes to authenticated;

-- O PostgREST preenche user_id automaticamente para favoritos e avaliações.
create or replace function public.fill_customer_user_id()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  new.user_id := auth.uid();
  return new;
end;
$$;
drop trigger if exists fill_customer_favorite_user on public.customer_favorites;
create trigger fill_customer_favorite_user before insert on public.customer_favorites for each row execute function public.fill_customer_user_id();
drop trigger if exists fill_customer_review_user on public.customer_reviews;
create trigger fill_customer_review_user before insert on public.customer_reviews for each row execute function public.fill_customer_user_id();

notify pgrst, 'reload schema';
