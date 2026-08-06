-- Harden customer account access and default-address behavior in an idempotent way.

create or replace function public.ensure_current_customer_account(
  p_full_name text,
  p_phone text,
  p_postal_code text,
  p_street text,
  p_number text,
  p_complement text,
  p_neighborhood text,
  p_city text,
  p_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_profile public.customer_profiles%rowtype;
  v_has_address boolean;
begin
  select * into v_user from auth.users where id = auth.uid();
  if not found then
    raise exception 'unauthorized';
  end if;

  insert into public.customer_profiles(
    user_id, full_name, email, phone, last_sign_in_at, active
  )
  values (
    auth.uid(),
    coalesce(nullif(trim(p_full_name), ''), 'Cliente'),
    v_user.email,
    nullif(trim(p_phone), ''),
    now(),
    true
  )
  on conflict (user_id) do update
    set full_name = case
      when trim(public.customer_profiles.full_name) = '' or lower(public.customer_profiles.full_name) = 'cliente' then excluded.full_name
      else public.customer_profiles.full_name
    end,
    email = coalesce(public.customer_profiles.email, excluded.email),
    phone = coalesce(public.customer_profiles.phone, excluded.phone),
    last_sign_in_at = now(),
    updated_at = now()
  returning * into v_profile;

  if nullif(trim(p_street), '') is not null and nullif(trim(p_number), '') is not null then
    select exists(select 1 from public.customer_addresses where user_id = auth.uid()) into v_has_address;
    if not v_has_address then
      insert into public.customer_addresses(
        user_id, label, postal_code, street, number, complement, neighborhood, city, reference, is_default
      ) values (
        auth.uid(),
        'Casa',
        nullif(trim(p_postal_code), ''),
        nullif(trim(p_street), ''),
        nullif(trim(p_number), ''),
        nullif(trim(p_complement), ''),
        nullif(trim(p_neighborhood), ''),
        nullif(trim(p_city), ''),
        nullif(trim(p_reference), ''),
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

revoke all on function public.ensure_current_customer_account(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.ensure_current_customer_account(text, text, text, text, text, text, text, text, text) to authenticated;

alter table public.customer_profiles enable row level security;
alter table public.customer_addresses enable row level security;

drop policy if exists "Customers read own profile" on public.customer_profiles;
create policy "Customers read own profile" on public.customer_profiles
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Customers update own profile" on public.customer_profiles;
create policy "Customers update own profile" on public.customer_profiles
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Customers manage own addresses" on public.customer_addresses;
create policy "Customers manage own addresses" on public.customer_addresses
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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

drop trigger if exists enforce_single_default_customer_address_trigger on public.customer_addresses;
create trigger enforce_single_default_customer_address_trigger
before insert or update on public.customer_addresses
for each row execute function public.enforce_single_default_customer_address();
