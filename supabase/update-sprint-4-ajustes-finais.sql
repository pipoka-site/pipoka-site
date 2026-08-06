-- PIPOKÁ Gourmet — Sprint 4: ajustes finais da área do cliente
-- Execute depois de update-sprint-4-area-cliente.sql.
-- Torna o login obrigatório no checkout, garante o endereço do cadastro e audita endereços.

-- Somente clientes autenticados podem criar pedidos pela função segura.
revoke execute on function public.create_order_secure(jsonb) from anon;
grant execute on function public.create_order_secure(jsonb) to authenticated;

-- Garante que pedidos criados por clientes autenticados usem os dados oficiais do perfil.
create or replace function public.attach_authenticated_customer_to_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.customer_profiles%rowtype;
begin
  if auth.uid() is null or private.is_admin() then
    return new;
  end if;

  select * into v_profile
  from public.customer_profiles
  where user_id = auth.uid();

  if v_profile.user_id is null then
    raise exception 'Complete seu cadastro antes de fazer o pedido.';
  end if;

  new.customer_id := auth.uid();
  new.customer_name := v_profile.full_name;
  new.customer_phone := v_profile.phone;
  return new;
end;
$$;

drop trigger if exists attach_authenticated_customer_order_trigger on public.orders;
create trigger attach_authenticated_customer_order_trigger
before insert on public.orders
for each row execute function public.attach_authenticated_customer_to_order();

-- Recria, quando necessário, o primeiro endereço a partir dos metadados do cadastro.
create or replace function public.ensure_current_customer_signup_address()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user auth.users%rowtype;
  v_has_address boolean;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then return false; end if;

  select exists(
    select 1 from public.customer_addresses where user_id = auth.uid()
  ) into v_has_address;

  if v_has_address then return true; end if;

  if coalesce(v_user.raw_user_meta_data->>'street','') = '' then
    return false;
  end if;

  insert into public.customer_addresses(
    user_id, label, postal_code, street, number, complement,
    neighborhood, city, reference, is_default
  ) values (
    auth.uid(),
    'Casa',
    coalesce(v_user.raw_user_meta_data->>'postal_code',''),
    v_user.raw_user_meta_data->>'street',
    coalesce(v_user.raw_user_meta_data->>'number',''),
    nullif(v_user.raw_user_meta_data->>'complement',''),
    coalesce(v_user.raw_user_meta_data->>'neighborhood',''),
    coalesce(v_user.raw_user_meta_data->>'city',''),
    nullif(v_user.raw_user_meta_data->>'reference',''),
    true
  );

  return true;
end;
$$;

revoke all on function public.ensure_current_customer_signup_address() from public, anon;
grant execute on function public.ensure_current_customer_signup_address() to authenticated;

-- Histórico de alterações dos endereços.
create table if not exists public.customer_address_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address_id uuid,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists customer_address_changes_user_date_idx
on public.customer_address_changes(user_id, created_at desc);

alter table public.customer_address_changes enable row level security;

drop policy if exists "Customers read own address changes" on public.customer_address_changes;
create policy "Customers read own address changes"
on public.customer_address_changes
for select to authenticated
using (user_id = auth.uid() or (select private.is_admin()));

grant select on public.customer_address_changes to authenticated;
revoke all on public.customer_address_changes from anon;

create or replace function public.audit_customer_address_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.customer_address_changes(user_id, address_id, action, old_data, new_data)
  values(
    coalesce(new.user_id, old.user_id),
    coalesce(new.id, old.id),
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_customer_address_change_trigger on public.customer_addresses;
create trigger audit_customer_address_change_trigger
after insert or update or delete on public.customer_addresses
for each row execute function public.audit_customer_address_change();

notify pgrst, 'reload schema';
