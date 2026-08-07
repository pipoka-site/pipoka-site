-- PIPOKA Gourmet - reviews: public_name and featured home cards
-- Minimal, idempotent and non-destructive migration.

alter table public.customer_reviews
  add column if not exists featured boolean not null default false,
  add column if not exists display_order integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customer_reviews_display_order_check'
      and conrelid = 'public.customer_reviews'::regclass
  ) then
    alter table public.customer_reviews
      add constraint customer_reviews_display_order_check
      check (display_order is null or display_order between 1 and 4);
  end if;
end $$;

create index if not exists customer_reviews_featured_order_idx
  on public.customer_reviews(featured, display_order, created_at desc);

create unique index if not exists customer_reviews_featured_display_order_unique_idx
  on public.customer_reviews(display_order)
  where featured = true and display_order is not null;

update public.customer_reviews cr
set public_name = cp.full_name
from public.customer_profiles cp
where cr.user_id = cp.user_id
  and coalesce(trim(cr.public_name), '') = ''
  and coalesce(trim(cp.full_name), '') <> '';

create or replace function public.fill_customer_review_public_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
begin
  if coalesce(trim(new.public_name), '') = '' then
    select nullif(trim(cp.full_name), '')
      into v_full_name
    from public.customer_profiles cp
    where cp.user_id = new.user_id
    limit 1;

    if v_full_name is not null then
      new.public_name := v_full_name;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.fill_customer_review_public_name() from public, anon;

create or replace function public.enforce_featured_customer_reviews_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_order integer;
begin
  if new.featured is not true then
    new.display_order := null;
    return new;
  end if;

  if new.display_order is not null and (new.display_order < 1 or new.display_order > 4) then
    raise exception 'A ordem de destaque deve ficar entre 1 e 4.';
  end if;

  select count(*)
    into v_count
  from public.customer_reviews cr
  where cr.featured = true
    and (tg_op = 'INSERT' or cr.id <> new.id);

  if tg_op = 'INSERT' then
    if v_count >= 4 then
      raise exception 'Limite de 4 avaliações destacadas atingido.';
    end if;
  elsif old.featured is distinct from true and v_count >= 4 then
    raise exception 'Limite de 4 avaliações destacadas atingido.';
  end if;

  if new.display_order is null then
    select gs.slot
      into v_order
    from generate_series(1, 4) as gs(slot)
    where not exists (
      select 1
      from public.customer_reviews cr
      where cr.featured = true
        and cr.display_order = gs.slot
        and (tg_op = 'INSERT' or cr.id <> new.id)
    )
    order by gs.slot
    limit 1;

    if v_order is null then
      raise exception 'Limite de 4 avaliações destacadas atingido.';
    end if;

    new.display_order := v_order;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_featured_customer_reviews_limit() from public, anon;

drop trigger if exists zz_fill_customer_review_public_name_trigger on public.customer_reviews;
create trigger zz_fill_customer_review_public_name_trigger
before insert or update on public.customer_reviews
for each row
execute function public.fill_customer_review_public_name();

drop trigger if exists zz_enforce_featured_customer_reviews_limit_trigger on public.customer_reviews;
create trigger zz_enforce_featured_customer_reviews_limit_trigger
before insert or update on public.customer_reviews
for each row
execute function public.enforce_featured_customer_reviews_limit();

notify pgrst, 'reload schema';