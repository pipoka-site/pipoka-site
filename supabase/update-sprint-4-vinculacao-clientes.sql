-- PIPOKÁ Gourmet — correção consolidada da vinculação de clientes
-- Execute depois de update-sprint-4-area-cliente.sql e update-sprint-4-ajustes-finais.sql.
-- Não apaga pedidos, contas, endereços ou configurações.

alter table public.customer_profiles alter column phone drop not null;

create or replace function public.handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_name text;
begin
  v_phone := nullif(public.normalize_br_phone(coalesce(new.raw_user_meta_data->>'phone','')), '');
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')), '');

  insert into public.customer_profiles(user_id, full_name, email, phone)
  values(
    new.id,
    coalesce(v_name, split_part(coalesce(new.email,''), '@', 1), 'Cliente'),
    lower(coalesce(new.email,'')),
    v_phone
  )
  on conflict(user_id) do update set
    email = excluded.email,
    full_name = case when trim(public.customer_profiles.full_name) = '' or lower(public.customer_profiles.full_name) = 'cliente' then excluded.full_name else public.customer_profiles.full_name end,
    phone = coalesce(public.customer_profiles.phone, excluded.phone),
    updated_at = now();

  if coalesce(new.raw_user_meta_data->>'street','') <> ''
     and not exists(select 1 from public.customer_addresses where user_id=new.id) then
    insert into public.customer_addresses(
      user_id,label,postal_code,street,number,complement,neighborhood,city,reference,is_default
    ) values(
      new.id,
      'Casa',
      coalesce(new.raw_user_meta_data->>'postal_code',''),
      new.raw_user_meta_data->>'street',
      coalesce(new.raw_user_meta_data->>'number',''),
      nullif(new.raw_user_meta_data->>'complement',''),
      coalesce(new.raw_user_meta_data->>'neighborhood',''),
      coalesce(new.raw_user_meta_data->>'city',''),
      nullif(new.raw_user_meta_data->>'reference',''),
      true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_customer_created on auth.users;
create trigger on_auth_customer_created
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.handle_new_customer();

-- Garante o perfil da sessão atual e recupera dados pendentes do cadastro.
create or replace function public.ensure_current_customer_account(
  p_full_name text default null,
  p_phone text default null,
  p_postal_code text default null,
  p_street text default null,
  p_number text default null,
  p_complement text default null,
  p_neighborhood text default null,
  p_city text default null,
  p_reference text default null
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
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into v_user from auth.users where id = auth.uid();
  if v_user.id is null then raise exception 'Usuário não encontrado.'; end if;

  v_name := coalesce(
    nullif(trim(p_full_name),''),
    nullif(trim(v_user.raw_user_meta_data->>'full_name'),''),
    nullif(split_part(coalesce(v_user.email,''),'@',1),''),
    'Cliente'
  );
  v_phone := nullif(public.normalize_br_phone(coalesce(nullif(trim(p_phone),''), v_user.raw_user_meta_data->>'phone','')), '');

  insert into public.customer_profiles(user_id,full_name,email,phone,last_sign_in_at)
  values(v_user.id,v_name,lower(coalesce(v_user.email,'')),v_phone,now())
  on conflict(user_id) do update set
    full_name = case when trim(public.customer_profiles.full_name)='' or lower(public.customer_profiles.full_name)='cliente' then excluded.full_name else public.customer_profiles.full_name end,
    email = excluded.email,
    phone = coalesce(public.customer_profiles.phone,excluded.phone),
    last_sign_in_at = now(),
    updated_at = now()
  returning * into v_profile;

  if nullif(trim(p_street),'') is not null
     and not exists(select 1 from public.customer_addresses where user_id=v_user.id) then
    insert into public.customer_addresses(
      user_id,label,postal_code,street,number,complement,neighborhood,city,reference,is_default
    ) values(
      v_user.id,'Casa',coalesce(trim(p_postal_code),''),trim(p_street),coalesce(trim(p_number),''),
      nullif(trim(p_complement),''),coalesce(trim(p_neighborhood),''),coalesce(trim(p_city),''),
      nullif(trim(p_reference),''),true
    );
  end if;

  return to_jsonb(v_profile);
end;
$$;
revoke all on function public.ensure_current_customer_account(text,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.ensure_current_customer_account(text,text,text,text,text,text,text,text,text) to authenticated;

-- Repara perfis de todas as contas existentes, inclusive administradores usados como clientes.
insert into public.customer_profiles(user_id,full_name,email,phone)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'),''),nullif(split_part(coalesce(u.email,''),'@',1),''),'Cliente'),
  lower(coalesce(u.email,'')),
  nullif(public.normalize_br_phone(coalesce(u.raw_user_meta_data->>'phone','')),'')
from auth.users u
on conflict(user_id) do update set
  email=excluded.email,
  full_name=case when trim(public.customer_profiles.full_name)='' or lower(public.customer_profiles.full_name)='cliente' then excluded.full_name else public.customer_profiles.full_name end,
  phone=coalesce(public.customer_profiles.phone,excluded.phone),
  updated_at=now();

-- Lista segura para a tela Clientes do ADM, inclusive clientes sem pedidos.
create or replace function public.list_customer_accounts()
returns table(
  user_id uuid,
  full_name text,
  email text,
  phone text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
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
    coalesce(p.phone,''),
    p.created_at,
    p.last_sign_in_at,
    count(a.id),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id',a.id,'label',a.label,'street',a.street,'number',a.number,
        'neighborhood',a.neighborhood,'city',a.city,'is_default',a.is_default
      ) order by a.is_default desc, a.created_at asc
    ) filter (where a.id is not null),'[]'::jsonb)
  from public.customer_profiles p
  left join public.customer_addresses a on a.user_id=p.user_id
  where private.is_admin()
  group by p.user_id,p.full_name,p.email,p.phone,p.created_at,p.last_sign_in_at
  order by p.created_at desc;
$$;
revoke all on function public.list_customer_accounts() from public, anon;
grant execute on function public.list_customer_accounts() to authenticated;

notify pgrst, 'reload schema';
