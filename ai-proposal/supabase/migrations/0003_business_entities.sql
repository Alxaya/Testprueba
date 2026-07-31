-- ============================================================================
-- 0003 · Clientes y catálogo
-- ============================================================================

create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,

  name          text not null check (length(btrim(name)) between 1 and 160),
  legal_name    text,
  tax_id        text,
  email         text,
  phone         text,
  address       jsonb not null default '{}'::jsonb,

  -- Determina el tratamiento fiscal: 'company' habilita la retención de IRPF y
  -- 'retailer_re' el recargo de equivalencia (docs/02 §4).
  client_type   public.client_type not null default 'individual',

  notes         text,
  tags          text[] not null default '{}',

  search_vector tsvector generated always as (
    public.build_search_vector(name, legal_name, tax_id, email, phone)
  ) stored,

  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Índices parciales: las consultas de la aplicación siempre excluyen lo
-- borrado, así que el índice no debe pagar por esas filas.
create index clients_org_idx     on public.clients (org_id, created_at desc) where deleted_at is null;
create index clients_search_idx  on public.clients using gin (search_vector);
create unique index clients_tax_id_idx
  on public.clients (org_id, upper(btrim(tax_id)))
  where deleted_at is null and tax_id is not null and btrim(tax_id) <> '';

-- ────────────────────────────────────────────────────────────────────────────
-- Catálogo: materiales, mano de obra y servicios
-- ────────────────────────────────────────────────────────────────────────────
-- Es la memoria de precios de la organización y, según docs/00 §1.2, el foso
-- defensivo real del producto: cuanto más se usa, mejores son los presupuestos
-- y más caro resulta cambiarse a la competencia.

create table public.catalog_items (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.organizations (id) on delete cascade,

  kind            public.item_kind not null,
  sku             text,
  name            text not null check (length(btrim(name)) between 1 and 200),
  description     text,
  unit            public.item_unit not null default 'unit',

  -- Importes SIEMPRE en céntimos enteros (decisión D2, docs/00).
  unit_cost_cents  bigint check (unit_cost_cents >= 0),
  unit_price_cents bigint not null check (unit_price_cents >= 0),

  -- null = hereda el tipo del perfil fiscal de la organización.
  tax_rate        numeric(5, 4) check (tax_rate >= 0 and tax_rate <= 1),

  supplier        text,
  tags            text[] not null default '{}',
  is_active       boolean not null default true,

  -- Ordena las sugerencias del autocompletado por lo que realmente se usa.
  usage_count     integer not null default 0 check (usage_count >= 0),
  last_used_at    timestamptz,

  search_vector   tsvector generated always as (
    public.build_search_vector(name, description, sku, supplier)
  ) stored,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index catalog_items_org_idx    on public.catalog_items (org_id, kind, is_active) where deleted_at is null;
create index catalog_items_search_idx on public.catalog_items using gin (search_vector);
create index catalog_items_usage_idx  on public.catalog_items (org_id, usage_count desc) where deleted_at is null and is_active;
create unique index catalog_items_sku_idx
  on public.catalog_items (org_id, upper(btrim(sku)))
  where deleted_at is null and sku is not null and btrim(sku) <> '';

create trigger clients_updated_at       before update on public.clients       for each row execute function public.set_updated_at();
create trigger catalog_items_updated_at before update on public.catalog_items for each row execute function public.set_updated_at();

comment on column public.catalog_items.unit_cost_cents is
  'Coste de compra. Opcional para el usuario, pero es lo que permite calcular margen por presupuesto.';
