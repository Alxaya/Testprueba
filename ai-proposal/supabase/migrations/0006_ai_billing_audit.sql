-- ============================================================================
-- 0006 · Sesiones de IA, contabilidad de coste, suscripción y auditoría
-- ============================================================================

create table public.ai_sessions (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  proposal_id uuid references public.proposals (id) on delete set null,
  user_id     uuid references auth.users (id) on delete set null,

  trade       text,
  -- { slots, answers, asked, completeness } — motor de entrevista, docs/03 §3.
  state       jsonb not null default '{}'::jsonb,
  status      text not null default 'active' check (status in ('active', 'completed', 'abandoned')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index ai_sessions_org_idx on public.ai_sessions (org_id, updated_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- Contabilidad de coste
-- ────────────────────────────────────────────────────────────────────────────
-- Una fila por llamada al proveedor, exitosa o no. Sin esta tabla es imposible
-- responder a "¿cuánto me cuesta atender a un cliente de plan Pro?", y el precio
-- de la suscripción se fija a ojo (docs/00, D6).

create table public.ai_requests (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  session_id    uuid references public.ai_sessions (id) on delete set null,
  user_id       uuid references auth.users (id) on delete set null,

  provider      text not null,
  model         text not null,
  purpose       public.ai_purpose not null,

  input_tokens  integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cached_tokens integer not null default 0 check (cached_tokens >= 0),

  -- Millonésimas de euro: precisión suficiente para tarifas por millón de
  -- tokens sin recurrir a coma flotante.
  cost_micros   bigint not null default 0 check (cost_micros >= 0),

  latency_ms    integer check (latency_ms >= 0),
  attempts      smallint not null default 1 check (attempts >= 1),
  status        public.ai_request_status not null default 'ok',
  error_code    text,
  created_at    timestamptz not null default now()
);

create index ai_requests_org_idx     on public.ai_requests (org_id, created_at desc);
create index ai_requests_purpose_idx on public.ai_requests (org_id, purpose, created_at desc);

comment on column public.ai_requests.cost_micros is
  'Coste en millonésimas de euro. Base del cálculo de margen bruto por organización.';

-- ────────────────────────────────────────────────────────────────────────────
-- Suscripción y cuotas
-- ────────────────────────────────────────────────────────────────────────────
-- Decisión D12 (docs/00): las tablas existen desde la primera migración aunque
-- la funcionalidad llegue en F7. Añadir límites al final los deja repartidos por
-- quince sitios, y siempre falta uno.

create table public.subscriptions (
  org_id                 uuid primary key references public.organizations (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  plan                   public.billing_plan not null default 'free',
  status                 text not null default 'active',
  seats                  integer not null default 1 check (seats >= 1),
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.usage_counters (
  org_id       uuid not null references public.organizations (id) on delete cascade,
  period_start date not null,
  metric       public.usage_metric not null,
  count        integer not null default 0 check (count >= 0),
  updated_at   timestamptz not null default now(),
  primary key (org_id, period_start, metric)
);

-- Idempotencia de webhooks: el proveedor de pagos garantiza "al menos una
-- entrega", no "exactamente una". Sin esta tabla, un reintento duplica el alta.
create table public.webhook_events (
  id           text primary key,
  provider     text not null,
  type         text not null,
  payload      jsonb not null,
  processed_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────────────────────

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  diff        jsonb,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index audit_log_org_idx    on public.audit_log (org_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);

create trigger ai_sessions_updated_at   before update on public.ai_sessions   for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
