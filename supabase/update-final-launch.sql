-- PIPOKÁ Gourmet — atualização final de lançamento
-- Execute depois das migrations anteriores.
-- Preserva dados existentes e consolida segurança, administradores, clientes e auditoria.

create extension if not exists pgcrypto;
create schema if not exists private;

-- Administradores privados ----------------------------------------------------
create table if not exists private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Migra administradores da estrutura antiga, quando ela existir.
do $$
begin
  if to_regclass('public.admin_users') is not null then
    execute $m$
      insert into private.admin_users(user_id,email,active)
      select u.id, lower(u.email), true
      from public.admin_users old
      join auth.users u on u.id = old.user_id
      where u.email is not null
      on conflict(user_id) do update set email=excluded.email, active=true
    $m$;
  end if;
end $$;

revoke all on schema private from public, anon, authenticated;
revoke all on table private.admin_users from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.admin_users a
    where a.user_id = auth.uid() and a.active = true
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Funções administrativas expostas somente a administradores autenticados.
create or replace function public.list_admin_users()
returns table(user_id uuid, email text, active boolean, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select a.user_id, a.email, a.active, a.created_at
  from private.admin_users a
  where private.is_admin()
  order by a.active desc, a.created_at asc;
$$;

create or replace function public.add_admin_by_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_user auth.users%rowtype;
begin
  if not private.is_admin() then raise exception 'Acesso negado.'; end if;
  select * into v_user from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if v_user.id is null then raise exception 'O e-mail ainda não possui usuário no Supabase Auth.'; end if;
  insert into private.admin_users(user_id,email,active)
  values(v_user.id,lower(v_user.email),true)
  on conflict(user_id) do update set email=excluded.email, active=true;
  return true;
end;
$$;

create or replace function public.set_admin_active(p_user_id uuid, p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_active_count integer;
begin
  if not private.is_admin() then raise exception 'Acesso negado.'; end if;
  if p_user_id = auth.uid() and p_active = false then
    raise exception 'Você não pode desativar o próprio acesso.';
  end if;
  select count(*) into v_active_count from private.admin_users where active=true;
  if p_active=false and v_active_count <= 1 then
    raise exception 'O sistema precisa manter ao menos um administrador ativo.';
  end if;
  update private.admin_users set active=p_active where user_id=p_user_id;
  if not found then raise exception 'Administrador não encontrado.'; end if;
  return true;
end;
$$;

revoke all on function public.list_admin_users() from public, anon;
revoke all on function public.add_admin_by_email(text) from public, anon;
revoke all on function public.set_admin_active(uuid,boolean) from public, anon;
grant execute on function public.list_admin_users() to authenticated;
grant execute on function public.add_admin_by_email(text) to authenticated;
grant execute on function public.set_admin_active(uuid,boolean) to authenticated;

-- Configurações novas ----------------------------------------------------------
alter table public.store_settings add column if not exists notifications_enabled boolean not null default true;
alter table public.store_settings add column if not exists auto_print_enabled boolean not null default false;
alter table public.store_settings add column if not exists print_format text not null default '80mm';
alter table public.orders add column if not exists internal_notes text;

-- Preferências administrativas de clientes ficam em tabela protegida; nunca em
-- store_settings, que possui leitura pública para o funcionamento do site.
create table if not exists public.customer_flags (
  phone text primary key,
  deleted boolean not null default false,
  favorite boolean not null default false,
  blocked boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.customer_flags enable row level security;
drop policy if exists "Only admins manage customer flags" on public.customer_flags;
create policy "Only admins manage customer flags" on public.customer_flags for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
revoke all on public.customer_flags from anon;
grant select, insert, update, delete on public.customer_flags to authenticated;

-- Auditoria -------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  action text not null,
  table_name text not null,
  record_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
drop policy if exists "Only admins read audit logs" on public.audit_logs;
create policy "Only admins read audit logs" on public.audit_logs
for select to authenticated using ((select private.is_admin()));
revoke all on public.audit_logs from anon;
grant select on public.audit_logs to authenticated;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs(user_id, action, table_name, record_id, details)
  values(
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce((case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end)->>'id',''),
    jsonb_build_object('old',case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,'new',case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end)
  );
  return case when tg_op='DELETE' then old else new end;
end;
$$;

drop trigger if exists audit_products on public.products;
create trigger audit_products after insert or update or delete on public.products for each row execute function public.write_audit_log();
drop trigger if exists audit_orders on public.orders;
create trigger audit_orders after update or delete on public.orders for each row execute function public.write_audit_log();
drop trigger if exists audit_store_settings on public.store_settings;
create trigger audit_store_settings after update on public.store_settings for each row execute function public.write_audit_log();

-- Recria políticas apontando explicitamente para private.is_admin(). -----------
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;

drop policy if exists "Only admins manage products" on public.products;
create policy "Only admins manage products" on public.products for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Only admins manage settings" on public.store_settings;
create policy "Only admins manage settings" on public.store_settings for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

drop policy if exists "Only admins read orders" on public.orders;
create policy "Only admins read orders" on public.orders for select to authenticated
using ((select private.is_admin()));
drop policy if exists "Only admins update orders" on public.orders;
create policy "Only admins update orders" on public.orders for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
drop policy if exists "Only admins delete orders" on public.orders;
create policy "Only admins delete orders" on public.orders for delete to authenticated
using ((select private.is_admin()));

-- Storage: leitura pública e escrita administrativa.
drop policy if exists "Only admins upload product images" on storage.objects;
create policy "Only admins upload product images" on storage.objects for insert to authenticated
with check (bucket_id='product-images' and (select private.is_admin()));
drop policy if exists "Only admins update product images" on storage.objects;
create policy "Only admins update product images" on storage.objects for update to authenticated
using (bucket_id='product-images' and (select private.is_admin()))
with check (bucket_id='product-images' and (select private.is_admin()));
drop policy if exists "Only admins delete product images" on storage.objects;
create policy "Only admins delete product images" on storage.objects for delete to authenticated
using (bucket_id='product-images' and (select private.is_admin()));

notify pgrst, 'reload schema';
