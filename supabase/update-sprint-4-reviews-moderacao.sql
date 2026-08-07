-- PIPOKÁ Gourmet — reviews: moderação e publicação pública segura
-- Migration mínima, idempotente e sem perda de dados.

alter table public.customer_reviews
  add column if not exists status text,
  add column if not exists public_name text;

update public.customer_reviews
set status = case when visible then 'approved' else 'pending' end
where status is null;

update public.customer_reviews
set status = 'pending'
where status not in ('pending', 'approved', 'rejected');

alter table public.customer_reviews
  alter column status set default 'pending';

alter table public.customer_reviews
  alter column visible set default false;

alter table public.customer_reviews
  alter column status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_reviews_status_check'
      and conrelid = 'public.customer_reviews'::regclass
  ) then
    alter table public.customer_reviews
      add constraint customer_reviews_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists customer_reviews_status_visible_created_idx
  on public.customer_reviews(status, visible, created_at desc);

create or replace function public.protect_customer_review_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select private.is_admin()) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.visible := false;
    new.public_name := null;
    new.admin_reply := null;
    return new;
  end if;

  new.status := 'pending';
  new.visible := false;
  new.public_name := old.public_name;
  new.admin_reply := old.admin_reply;
  return new;
end;
$$;

revoke all on function public.protect_customer_review_admin_fields() from public, anon;

drop trigger if exists protect_customer_review_admin_fields_trigger on public.customer_reviews;
create trigger protect_customer_review_admin_fields_trigger
before insert or update on public.customer_reviews
for each row
execute function public.protect_customer_review_admin_fields();

alter table public.customer_reviews enable row level security;

drop policy if exists "Public read approved reviews" on public.customer_reviews;
create policy "Public read approved reviews"
on public.customer_reviews
for select
to anon, authenticated
using (status = 'approved' and visible = true);

grant select on public.customer_reviews to anon;

notify pgrst, 'reload schema';
