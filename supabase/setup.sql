-- Execute este arquivo no Supabase: SQL Editor > New query > Run

create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric(10,2) not null default 0,
  category text not null default 'Pipoca Gourmet',
  badge text,
  image text not null default '/produtos/pipoca-gourmet-500ml.jpg',
  preparation_time integer not null default 30 check (preparation_time > 0),
  images text[] not null default '{}',
  option_groups jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  hero_badge text not null default 'Feita com amor para você',
  hero_title text not null default 'Uma explosão de sabor em cada punhado.',
  hero_subtitle text not null default 'Pipocas gourmet artesanais, crocantes e preparadas com ingredientes selecionados para transformar qualquer momento.',
  about_button text not null default 'Conheça a PIPOKÁ',
  catalog_button text not null default 'Ver cardápio',
  delivery_fee numeric(10,2) not null default 8,
  whatsapp_number text not null default '5575999906963',
  payment_methods jsonb not null default '["Pix","Dinheiro","Cartão de débito","Cartão de crédito"]'::jsonb,
  store_open boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.store_settings enable row level security;

drop policy if exists "Public read active products" on public.products;
create policy "Public read active products" on public.products for select using (active = true or auth.role() = 'authenticated');
drop policy if exists "Admin manage products" on public.products;
create policy "Admin manage products" on public.products for all to authenticated using (true) with check (true);

drop policy if exists "Public read settings" on public.store_settings;
create policy "Public read settings" on public.store_settings for select using (true);
drop policy if exists "Admin manage settings" on public.store_settings;
create policy "Admin manage settings" on public.store_settings for all to authenticated using (true) with check (true);

insert into public.store_settings (id) values (1) on conflict (id) do nothing;
insert into public.products (id,name,description,price,category,badge,image,active) values
('pipoca-gourmet-500ml','Pipoca Gourmet 500 ml (M)','Pipoca gourmet artesanal em pote de 500 ml, ideal para saborear sozinho ou compartilhar.',25,'Pipoca Gourmet','Tamanho M','/produtos/pipoca-gourmet-500ml.jpg',true),
('pipoca-gourmet-1l','Pipoca Gourmet 1 L (G)','Pipoca gourmet artesanal em pote de 1 litro, perfeita para dividir e deixar o momento mais gostoso.',35,'Pipoca Gourmet','Tamanho G','/produtos/pipoca-gourmet-1l.jpg',true)
on conflict (id) do nothing;
