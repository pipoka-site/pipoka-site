-- PIPOKÁ Gourmet — revisão de produção: clientes, salvamento e administração
-- Execute depois das migrations anteriores da Sprint 4.

alter table public.customer_profiles add column if not exists active boolean not null default true;
create index if not exists customer_profiles_active_created_idx on public.customer_profiles(active, created_at desc);

-- Não revela se um telefone pertence a uma conta desativada.
create or replace function public.customer_login_email(p_phone text)
returns text language sql stable security definer set search_path = '' as $$
  select email from public.customer_profiles
  where phone = public.normalize_br_phone(p_phone) and active = true
  limit 1;
$$;
revoke all on function public.customer_login_email(text) from public;
grant execute on function public.customer_login_email(text) to anon, authenticated;

-- Garante perfil/endereço e bloqueia sessões de contas desativadas.
create or replace function public.ensure_current_customer_account(
  p_full_name text default null, p_phone text default null, p_postal_code text default null,
  p_street text default null, p_number text default null, p_complement text default null,
  p_neighborhood text default null, p_city text default null, p_reference text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user auth.users%rowtype; v_name text; v_phone text; v_profile public.customer_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into v_user from auth.users where id=auth.uid();
  if v_user.id is null then raise exception 'Usuário não encontrado.'; end if;
  if exists(select 1 from public.customer_profiles where user_id=v_user.id and active=false) then
    raise exception 'Esta conta está desativada. Entre em contato com a loja.';
  end if;
  v_name := coalesce(nullif(trim(p_full_name),''),nullif(trim(v_user.raw_user_meta_data->>'full_name'),''),nullif(split_part(coalesce(v_user.email,''),'@',1),''),'Cliente');
  v_phone := nullif(public.normalize_br_phone(coalesce(nullif(trim(p_phone),''),v_user.raw_user_meta_data->>'phone','')),'');
  insert into public.customer_profiles(user_id,full_name,email,phone,last_sign_in_at,active)
  values(v_user.id,v_name,lower(coalesce(v_user.email,'')),v_phone,now(),true)
  on conflict(user_id) do update set
    full_name=case when trim(public.customer_profiles.full_name)='' or lower(public.customer_profiles.full_name)='cliente' then excluded.full_name else public.customer_profiles.full_name end,
    email=excluded.email, phone=coalesce(public.customer_profiles.phone,excluded.phone), last_sign_in_at=now(), updated_at=now()
  returning * into v_profile;
  if nullif(trim(p_street),'') is not null and not exists(select 1 from public.customer_addresses where user_id=v_user.id) then
    insert into public.customer_addresses(user_id,label,postal_code,street,number,complement,neighborhood,city,reference,is_default)
    values(v_user.id,'Casa',coalesce(trim(p_postal_code),''),trim(p_street),coalesce(trim(p_number),''),nullif(trim(p_complement),''),coalesce(trim(p_neighborhood),''),coalesce(trim(p_city),''),nullif(trim(p_reference),''),true);
  end if;
  return to_jsonb(v_profile);
end; $$;
revoke all on function public.ensure_current_customer_account(text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.ensure_current_customer_account(text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.admin_update_customer_profile(p_user_id uuid,p_full_name text default null,p_phone text default null)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Acesso negado.'; end if;
  update public.customer_profiles set
    full_name=coalesce(nullif(trim(p_full_name),''),full_name),
    phone=case when p_phone is null then phone else nullif(public.normalize_br_phone(p_phone),'') end,
    updated_at=now()
  where user_id=p_user_id;
  if not found then raise exception 'Cliente não encontrado.'; end if;
  return true;
end; $$;
revoke all on function public.admin_update_customer_profile(uuid,text,text) from public,anon;
grant execute on function public.admin_update_customer_profile(uuid,text,text) to authenticated;

create or replace function public.admin_set_customer_active(p_user_id uuid,p_active boolean)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not private.is_admin() then raise exception 'Acesso negado.'; end if;
  update public.customer_profiles set active=p_active,updated_at=now() where user_id=p_user_id;
  if not found then raise exception 'Cliente não encontrado.'; end if;
  insert into public.audit_logs(user_id,action,table_name,record_id,details)
  values(auth.uid(),case when p_active then 'CUSTOMER_REACTIVATED' else 'CUSTOMER_DEACTIVATED' end,'customer_profiles',p_user_id::text,jsonb_build_object('active',p_active));
  return true;
end; $$;
revoke all on function public.admin_set_customer_active(uuid,boolean) from public,anon;
grant execute on function public.admin_set_customer_active(uuid,boolean) to authenticated;

create or replace function public.admin_upsert_customer_address(
 p_user_id uuid,p_address_id uuid,p_label text,p_postal_code text,p_street text,p_number text,
 p_complement text,p_neighborhood text,p_city text,p_reference text,p_is_default boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(p_address_id,gen_random_uuid());
begin
 if not private.is_admin() then raise exception 'Acesso negado.'; end if;
 insert into public.customer_addresses(id,user_id,label,postal_code,street,number,complement,neighborhood,city,reference,is_default)
 values(v_id,p_user_id,coalesce(nullif(trim(p_label),''),'Casa'),coalesce(trim(p_postal_code),''),trim(p_street),trim(p_number),nullif(trim(p_complement),''),trim(p_neighborhood),trim(p_city),nullif(trim(p_reference),''),coalesce(p_is_default,false))
 on conflict(id) do update set label=excluded.label,postal_code=excluded.postal_code,street=excluded.street,number=excluded.number,complement=excluded.complement,neighborhood=excluded.neighborhood,city=excluded.city,reference=excluded.reference,is_default=excluded.is_default,updated_at=now()
 where public.customer_addresses.user_id=p_user_id;
 return v_id;
end; $$;
revoke all on function public.admin_upsert_customer_address(uuid,uuid,text,text,text,text,text,text,text,text,boolean) from public,anon;
grant execute on function public.admin_upsert_customer_address(uuid,uuid,text,text,text,text,text,text,text,text,boolean) to authenticated;

drop function if exists public.list_customer_accounts();
create or replace function public.list_customer_accounts()
returns table(user_id uuid,full_name text,email text,phone text,created_at timestamptz,last_sign_in_at timestamptz,active boolean,address_count bigint,addresses jsonb)
language sql stable security definer set search_path='' as $$
 select p.user_id,p.full_name,p.email,coalesce(p.phone,''),p.created_at,p.last_sign_in_at,p.active,count(a.id),
 coalesce(jsonb_agg(jsonb_build_object('id',a.id,'label',a.label,'postal_code',a.postal_code,'street',a.street,'number',a.number,'complement',a.complement,'neighborhood',a.neighborhood,'city',a.city,'reference',a.reference,'is_default',a.is_default) order by a.is_default desc,a.created_at asc) filter(where a.id is not null),'[]'::jsonb)
 from public.customer_profiles p left join public.customer_addresses a on a.user_id=p.user_id
 where private.is_admin() group by p.user_id,p.full_name,p.email,p.phone,p.created_at,p.last_sign_in_at,p.active order by p.created_at desc;
$$;
revoke all on function public.list_customer_accounts() from public,anon;
grant execute on function public.list_customer_accounts() to authenticated;

notify pgrst,'reload schema';
