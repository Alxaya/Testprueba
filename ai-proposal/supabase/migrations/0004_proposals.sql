-- ============================================================================
-- 0004 · Presupuestos, líneas, versiones, plantillas y series de numeración
-- ============================================================================
-- Decisión D4 (docs/00): el presupuesto se guarda ESTRUCTURADO. Las líneas son
-- filas reales, no texto dentro de un blob. Sin esto no hay memoria de precios,
-- ni analítica, ni margen, ni foso defensivo.

create table public.document_series (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  kind        public.document_kind not null default 'proposal',
  prefix      text not null default 'PRE',
  year        integer not null,
  next_number integer not null default 1 check (next_number >= 1),
  unique (org_id, kind, year)
);

comment on table public.document_series is
  'Numeración por organización y año. Un borrador NUNCA consume número: en facturas los huecos de serie son una infracción (docs/02 §5).';

create table public.proposals (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  client_id   uuid references public.clients (id) on delete set null,
  created_by  uuid references auth.users (id) on delete set null,
  assigned_to uuid references auth.users (id) on delete set null,

  -- null mientras es borrador; se asigna al pasar a 'ready'/'sent'.
  number      text,
  series_id   uuid references public.document_series (id) on delete set null,

  status      public.proposal_status not null default 'draft',
  title       text not null default '' check (length(title) <= 200),
  trade       text,
  currency    char(3) not null default 'EUR',

  -- Secciones narrativas + trazabilidad de IA. Esquema en docs/02 §3.
  -- `schema_version` permite evolucionar el formato sin migrar datos: el lector
  -- migra en memoria al abrir.
  document    jsonb not null default jsonb_build_object('schema_version', 1),

  -- Copia congelada del perfil fiscal al emitir: un cambio futuro de régimen
  -- no debe alterar un documento ya enviado a un cliente.
  tax_profile jsonb,

  -- Todos los importes en céntimos enteros.
  subtotal_cents  bigint not null default 0,
  discount_cents  bigint not null default 0 check (discount_cents >= 0),
  tax_total_cents bigint not null default 0,
  retention_cents bigint not null default 0 check (retention_cents >= 0),
  total_cents     bigint not null default 0,

  valid_until date,
  issued_at   timestamptz,
  sent_at     timestamptz,
  viewed_at   timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,

  -- Bloqueo optimista para el autoguardado (docs/01 §5).
  version     integer not null default 1 check (version >= 1),

  search_vector tsvector generated always as (
    public.build_search_vector(coalesce(number, ''), title, coalesce(trade, ''))
  ) stored,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  -- Red de seguridad barata: si algún cálculo produjese un descuadre, la
  -- transacción falla en vez de escribir datos económicos incorrectos.
  constraint proposals_totals_consistent check (
    total_cents = subtotal_cents - discount_cents + tax_total_cents - retention_cents
  ),

  -- Un documento numerado no puede volver a estado borrador.
  constraint proposals_number_requires_status check (
    (number is null) or (status <> 'draft')
  ),

  constraint proposals_document_versioned check (
    jsonb_typeof(document -> 'schema_version') = 'number'
  )
);

create unique index proposals_number_idx
  on public.proposals (org_id, number)
  where number is not null and deleted_at is null;

create index proposals_org_created_idx on public.proposals (org_id, created_at desc) where deleted_at is null;
create index proposals_org_status_idx  on public.proposals (org_id, status)           where deleted_at is null;
create index proposals_org_client_idx  on public.proposals (org_id, client_id)        where deleted_at is null and client_id is not null;
create index proposals_search_idx      on public.proposals using gin (search_vector);

-- ────────────────────────────────────────────────────────────────────────────

create table public.proposal_lines (
  id               uuid primary key default gen_random_uuid(),
  proposal_id      uuid not null references public.proposals (id) on delete cascade,
  -- org_id denormalizado a propósito: permite que la política RLS de esta tabla
  -- no tenga que hacer JOIN con proposals en cada fila evaluada.
  org_id           uuid not null references public.organizations (id) on delete cascade,

  position         integer not null check (position >= 0),
  kind             public.item_kind not null default 'material',
  description      text not null check (length(btrim(description)) between 1 and 500),

  quantity         numeric(12, 3) not null check (quantity > 0),
  unit             public.item_unit not null default 'unit',
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  discount_pct     numeric(5, 4) not null default 0 check (discount_pct >= 0 and discount_pct <= 1),
  tax_rate         numeric(5, 4) not null default 0.21 check (tax_rate >= 0 and tax_rate <= 1),

  -- Base imponible de la línea, ya redondeada a céntimo (docs/02 §4.2).
  line_total_cents bigint not null check (line_total_cents >= 0),

  -- Trazabilidad con el catálogo: es lo que alimenta el histórico de precios
  -- automáticamente, sin obligar al usuario a mantener un catálogo a mano.
  catalog_item_id  uuid references public.catalog_items (id) on delete set null,

  created_at       timestamptz not null default now(),

  unique (proposal_id, position) deferrable initially deferred
);

create index proposal_lines_proposal_idx on public.proposal_lines (proposal_id, position);
create index proposal_lines_catalog_idx  on public.proposal_lines (catalog_item_id) where catalog_item_id is not null;

comment on constraint proposal_lines_proposal_id_position_key on public.proposal_lines is
  'DEFERRABLE: reordenar líneas dentro de una transacción atravesaría posiciones duplicadas de forma transitoria.';

-- ────────────────────────────────────────────────────────────────────────────

create table public.proposal_versions (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete cascade,
  version     integer not null check (version >= 1),
  snapshot    jsonb not null,
  author_id   uuid references auth.users (id) on delete set null,
  reason      text,
  created_at  timestamptz not null default now(),
  unique (proposal_id, version)
);

create index proposal_versions_lookup_idx on public.proposal_versions (proposal_id, version desc);

comment on table public.proposal_versions is
  'Historial. No se escribe en cada pulsación: solo en puntos de control (docs/01 §5).';

-- ────────────────────────────────────────────────────────────────────────────

create table public.proposal_templates (
  id          uuid primary key default gen_random_uuid(),
  -- null = plantilla global del sistema, visible para todas las organizaciones.
  org_id      uuid references public.organizations (id) on delete cascade,
  trade       text,
  name        text not null check (length(btrim(name)) between 1 and 120),
  description text,
  content     jsonb not null,
  is_public   boolean not null default false,
  usage_count integer not null default 0,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  constraint templates_global_is_public check (org_id is not null or is_public)
);

create index proposal_templates_org_idx    on public.proposal_templates (org_id, trade) where deleted_at is null;
create index proposal_templates_public_idx on public.proposal_templates (trade)         where org_id is null and deleted_at is null;

create trigger proposals_updated_at          before update on public.proposals          for each row execute function public.set_updated_at();
create trigger proposal_templates_updated_at before update on public.proposal_templates for each row execute function public.set_updated_at();
