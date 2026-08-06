-- PIPOKÁ Gourmet — Etapa 0.2: revisão e estabilização do banco
-- Executar após as migrations já existentes da área do cliente e da gestão.
-- Seguro para banco com dados existentes, sem apagar tabelas, colunas ou dados.

create extension if not exists pgcrypto;
create schema if not exists private;

alter table public.customer_profiles add column if not exists active boolean not null default true;
alter table public.customer_profiles alter column phone drop not null;

create index if not exists idx_orders_status_created_at on public.orders(status, created_at desc);
create index if not exists idx_customer_reviews_user_created_at on public.customer_reviews(user_id, created_at desc);

create or replace function public.normalize_br_phone(value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when regexp_replace(coalesce(value,''), '\D', '', 'g') = '' then ''
    when regexp_replace(value, '\D', '', 'g') like '55%' then '+' || regexp_replace(value, '\D', '', 'g')
    else '+55' || regexp_replace(value, '\D', '', 'g')
  end;
$$;

create or replace function public.ensure_current_customer_account(
  p_full_name text default null::text,
  p_phone text default null::text,
  p_postal_code text default null::text,
  p_street text default null::text,
  p_number text default null::text,
  p_complement text default null::text,
  p_neighborhood text default null::text,
  p_city text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_name text;
  v_phone text;
  v_profile public.customer_profiles%rowtype;
  v_has_address boolean;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then
    raise exception 'Usuário não encontrado.';
  end if;

  if exists(select 1 from public.customer_profiles where user_id = v_user.id and active = false) then
    raise exception 'Esta conta está desativada. Entre em contato com a loja.';
  end if;

  v_name := coalesce(
    nullif(trim(p_full_name), ''),
    nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''),
    nullif(split_part(coalesce(v_user.email, ''), '@', 1), ''),
    'Cliente'
  );
  v_phone := nullif(public.normalize_br_phone(coalesce(nullif(trim(p_phone), ''), v_user.raw_user_meta_data->>'phone', '')), '');

  insert into public.customer_profiles(user_id, full_name, email, phone, last_sign_in_at, active)
  values(v_user.id, v_name, lower(coalesce(v_user.email, '')), v_phone, now(), true)
  on conflict(user_id) do update
    set full_name = case
      when trim(public.customer_profiles.full_name) = '' or lower(public.customer_profiles.full_name) = 'cliente' then excluded.full_name
      else public.customer_profiles.full_name
    end,
    email = coalesce(public.customer_profiles.email, excluded.email),
    phone = coalesce(public.customer_profiles.phone, excluded.phone),
    last_sign_in_at = now(),
    updated_at = now(),
    active = true
  returning * into v_profile;

  if nullif(trim(p_street), '') is not null and nullif(trim(p_number), '') is not null then
    select exists(select 1 from public.customer_addresses where user_id = v_user.id) into v_has_address;
    if not v_has_address then
      insert into public.customer_addresses(
        user_id, label, postal_code, street, number, complement, neighborhood, city, reference, is_default
      ) values (
        v_user.id,
        'Casa',
        nullif(trim(p_postal_code), ''),
        nullif(trim(p_street), ''),
        nullif(trim(p_number), ''),
        nullif(trim(p_complement), ''),
        nullif(trim(p_neighborhood), ''),
        nullif(trim(p_city), ''),
        null,
        true
      );
    end if;
  end if;

  return jsonb_build_object(
    'user_id', v_profile.user_id,
    'full_name', v_profile.full_name,
    'email', v_profile.email,
    'phone', v_profile.phone,
    'active', v_profile.active
  );
end;
$$;

revoke all on function public.ensure_current_customer_account(text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.ensure_current_customer_account(text, text, text, text, text, text, text, text) to authenticated;

create or replace function public.customer_login_email(p_phone text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select email
  from public.customer_profiles
  where phone = public.normalize_br_phone(p_phone)
    and active = true
  limit 1;
$$;
revoke all on function public.customer_login_email(text) from public;
grant execute on function public.customer_login_email(text) to anon, authenticated;

create or replace function public.touch_customer_login()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.customer_profiles
  set last_sign_in_at = now(), updated_at = now()
  where user_id = auth.uid();

  return true;
end;
$$;
revoke all on function public.touch_customer_login() from public, anon;
grant execute on function public.touch_customer_login() to authenticated;

create or replace function public.link_order_to_current_customer(p_order_code text, p_tracking_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select phone into v_phone
  from public.customer_profiles
  where user_id = auth.uid();

  update public.orders
  set customer_id = auth.uid()
  where order_code = p_order_code
    and tracking_token = p_tracking_token
    and public.normalize_br_phone(customer_phone) = v_phone;

  return found;
end;
$$;
revoke all on function public.link_order_to_current_customer(text, text) from public, anon;
grant execute on function public.link_order_to_current_customer(text, text) to authenticated;

create or replace function public.link_previous_customer_orders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_count integer;
begin
  if auth.uid() is null then
    return 0;
  end if;

  select phone into v_phone
  from public.customer_profiles
  where user_id = auth.uid();

  update public.orders
  set customer_id = auth.uid()
  where customer_id is null
    and public.normalize_br_phone(customer_phone) = v_phone;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.link_previous_customer_orders() from public, anon;
grant execute on function public.link_previous_customer_orders() to authenticated;

create or replace function public.list_customer_accounts()
returns table(
  user_id uuid,
  full_name text,
  email text,
  phone text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  active boolean,
  address_count bigint,
  addresses jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.user_id,
    p.full_name,
    p.email,
    coalesce(p.phone, ''),
    p.created_at,
    p.last_sign_in_at,
    p.active,
    count(a.id),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'label', a.label,
          'postal_code', a.postal_code,
          'street', a.street,
          'number', a.number,
          'complement', a.complement,
          'neighborhood', a.neighborhood,
          'city', a.city,
          'reference', a.reference,
          'is_default', a.is_default
        ) order by a.is_default desc, a.created_at asc
      ) filter (where a.id is not null),
      '[]'::jsonb
    )
  from public.customer_profiles p
  left join public.customer_addresses a on a.user_id = p.user_id
  where private.is_admin()
  group by p.user_id, p.full_name, p.email, p.phone, p.created_at, p.last_sign_in_at, p.active
  order by p.created_at desc;
$$;
revoke all on function public.list_customer_accounts() from public, anon;
grant execute on function public.list_customer_accounts() to authenticated;

create or replace function public.enforce_single_default_customer_address()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_default then
    update public.customer_addresses
    set is_default = false
    where user_id = new.user_id and id <> coalesce(new.id, old.id);
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_default_customer_address_trigger on public.customer_addresses;
drop trigger if exists enforce_single_default_customer_address_trigger on public.customer_addresses;
create trigger enforce_single_default_customer_address_trigger
before insert or update on public.customer_addresses
for each row execute function public.enforce_single_default_customer_address();

alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.customer_favorites enable row level security;
alter table public.customer_reviews enable row level security;
alter table public.customer_profile_changes enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Customers read own profile" on public.customer_profiles;
create policy "Customers read own profile" on public.customer_profiles for select to authenticated
using (user_id = auth.uid() or (select private.is_admin()));
drop policy if exists "Customers update own profile" on public.customer_profiles;
create policy "Customers update own profile" on public.customer_profiles for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Customers manage own addresses" on public.customer_addresses;
create policy "Customers manage own addresses" on public.customer_addresses for all to authenticated
using (user_id = auth.uid() or (select private.is_admin()))
with check (user_id = auth.uid() or (select private.is_admin()));

drop policy if exists "Customers manage own favorites" on public.customer_favorites;
create policy "Customers manage own favorites" on public.customer_favorites for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Customers read own reviews" on public.customer_reviews;
create policy "Customers read own reviews" on public.customer_reviews for select to authenticated
using (user_id = auth.uid() or (select private.is_admin()));

drop policy if exists "Customers create own reviews" on public.customer_reviews;
create policy "Customers create own reviews" on public.customer_reviews for insert to authenticated
with check (
  user_id = auth.uid()
  and exists(select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid() and o.status = 'completed')
);

drop policy if exists "Customers update own reviews" on public.customer_reviews;
create policy "Customers update own reviews" on public.customer_reviews for update to authenticated
using (user_id = auth.uid() or (select private.is_admin()))
with check (user_id = auth.uid() or (select private.is_admin()));

drop policy if exists "Customers read own profile changes" on public.customer_profile_changes;
create policy "Customers read own profile changes" on public.customer_profile_changes for select to authenticated
using (user_id = auth.uid() or (select private.is_admin()));

drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders" on public.orders for select to authenticated
using (customer_id = auth.uid() or (select private.is_admin()));

revoke all on public.customer_profiles from anon;
revoke all on public.customer_addresses from anon;
revoke all on public.customer_favorites from anon;
revoke all on public.customer_reviews from anon;
revoke all on public.customer_profile_changes from anon;
revoke all on public.orders from anon;

grant select, update on public.customer_profiles to authenticated;
grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, insert, delete on public.customer_favorites to authenticated;
grant select, insert, update on public.customer_reviews to authenticated;
grant select on public.customer_profile_changes to authenticated;
grant select on public.orders to authenticated;

notify pgrst, 'reload schema';
