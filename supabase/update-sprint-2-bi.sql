-- PIPOKÁ Gourmet — Sprint 2: Dashboard 2.0 e Business Intelligence
-- Execute após update-final-launch.sql. Preserva todos os dados existentes.

alter table public.store_settings add column if not exists bi_revenue_goal numeric not null default 0;
alter table public.store_settings add column if not exists bi_orders_goal integer not null default 0;
alter table public.store_settings add column if not exists bi_show_insights boolean not null default true;
alter table public.store_settings add column if not exists bi_show_revenue_chart boolean not null default true;
alter table public.store_settings add column if not exists bi_show_orders_chart boolean not null default true;
alter table public.store_settings add column if not exists bi_show_payments_chart boolean not null default true;
alter table public.store_settings add column if not exists bi_show_fulfillment_chart boolean not null default true;
alter table public.store_settings add column if not exists bi_show_peak_chart boolean not null default true;
alter table public.store_settings add column if not exists bi_show_weekdays_chart boolean not null default true;
alter table public.store_settings add column if not exists bi_show_products_ranking boolean not null default true;
alter table public.store_settings add column if not exists bi_show_flavors_ranking boolean not null default true;
alter table public.store_settings add column if not exists bi_show_customers_ranking boolean not null default true;

-- Índices para acelerar filtros e agrupamentos usados pelo BI.
create index if not exists orders_created_at_active_idx on public.orders(created_at desc) where deleted_at is null;
create index if not exists orders_status_created_at_idx on public.orders(status, created_at desc) where deleted_at is null;
create index if not exists orders_fulfillment_created_at_idx on public.orders(fulfillment, created_at desc) where deleted_at is null;
create index if not exists orders_payment_created_at_idx on public.orders(payment_method, created_at desc) where deleted_at is null;

notify pgrst, 'reload schema';
