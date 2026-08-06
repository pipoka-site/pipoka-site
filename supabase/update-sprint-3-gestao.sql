-- PIPOKÁ Gourmet — Sprint 3
-- Auditoria ampliada e índices de gestão. Preserva todos os dados existentes.

create index if not exists idx_customer_flags_updated_at on public.customer_flags(updated_at desc);
create index if not exists idx_customer_flags_deleted on public.customer_flags(deleted);
create index if not exists idx_audit_logs_created_at on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_table_action on public.audit_logs(table_name, action);

-- Registra alterações nas preferências administrativas dos clientes.
drop trigger if exists audit_customer_flags on public.customer_flags;
create trigger audit_customer_flags
after insert or update or delete on public.customer_flags
for each row execute function public.write_audit_log();

-- Auditoria específica para administradores privados.
create or replace function private.write_admin_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs(user_id, action, table_name, record_id, details)
  values(
    auth.uid(),
    tg_op,
    'admin_users',
    coalesce((case when tg_op='DELETE' then old.user_id else new.user_id end)::text, ''),
    jsonb_build_object(
      'email', case when tg_op='DELETE' then old.email else new.email end,
      'active_before', case when tg_op in ('UPDATE','DELETE') then old.active else null end,
      'active_after', case when tg_op in ('INSERT','UPDATE') then new.active else null end
    )
  );
  return case when tg_op='DELETE' then old else new end;
end;
$$;

revoke all on function private.write_admin_audit_log() from public, anon, authenticated;

drop trigger if exists audit_admin_users on private.admin_users;
create trigger audit_admin_users
after insert or update or delete on private.admin_users
for each row execute function private.write_admin_audit_log();

notify pgrst, 'reload schema';
