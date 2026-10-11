-- Search index for Zid product questions on WhatsApp.
--
-- Zid's AI Connector can list and read products but cannot search them, so
-- Reload keeps the minimum needed to find a product by name or SKU: names,
-- SKU, a thumbnail and whether it is visible in the store. Price, stock and
-- the purchase link are never stored here; they are read live from Zid each
-- time, so an answer is never stale.
--
-- Server-side only: no policies, no grants. Every row is scoped to one store.

create table public.zid_catalog_products (
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id text not null,
  name_ar text,
  name_en text,
  sku text,
  search_text text not null default '',
  thumbnail_url text,
  is_visible boolean not null default true,
  synced_at timestamptz not null default now(),
  primary key (store_id, product_id)
);
create index zid_catalog_products_visible_idx on public.zid_catalog_products (store_id, is_visible);
alter table public.zid_catalog_products enable row level security;
revoke all on public.zid_catalog_products from public, anon, authenticated;

create table public.zid_catalog_sync (
  store_id uuid primary key references public.stores(id) on delete cascade,
  synced_at timestamptz not null default now(),
  product_count integer not null default 0,
  -- false when the catalog was larger than one sync could read.
  complete boolean not null default true
);
alter table public.zid_catalog_sync enable row level security;
revoke all on public.zid_catalog_sync from public, anon, authenticated;
