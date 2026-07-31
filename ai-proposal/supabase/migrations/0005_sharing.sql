-- ============================================================================
-- 0005 · Enlaces compartidos y seguimiento
-- ============================================================================
-- Decisión D10 (docs/00). Además de ser lo correcto en seguridad, habilita la
-- función que más se percibe como "magia": "tu cliente ha visto el presupuesto
-- hace 10 minutos", y aceptar/rechazar con un botón.

create table public.share_links (
  id            uuid primary key default gen_random_uuid(),
  proposal_id   uuid not null references public.proposals (id) on delete cascade,
  org_id        uuid not null references public.organizations (id) on delete cascade,

  -- SHA-256 del token. El token en claro solo existe una vez, en la respuesta
  -- que crea el enlace: una filtración de la base de datos no entrega accesos
  -- utilizables.
  token_hash    text not null unique check (length(token_hash) = 64),

  password_hash text,
  expires_at    timestamptz,
  revoked_at    timestamptz,

  -- Contadores desnormalizados: la página pública no debe agregar `share_events`
  -- en cada visita.
  view_count    integer not null default 0 check (view_count >= 0),
  last_viewed_at timestamptz,

  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index share_links_proposal_idx on public.share_links (proposal_id, created_at desc);

create table public.share_events (
  id            uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.share_links (id) on delete cascade,
  org_id        uuid not null references public.organizations (id) on delete cascade,
  type          public.share_event_type not null,

  -- Hash con sal en lugar de la IP: permite deduplicar visitas sin almacenar un
  -- dato personal directamente identificable. Decisión de RGPD tomada en el
  -- esquema, no parcheada después.
  ip_hash       text,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index share_events_link_idx on public.share_events (share_link_id, created_at desc);
create index share_events_org_idx  on public.share_events (org_id, created_at desc);

comment on column public.share_links.token_hash is
  'SHA-256 en hexadecimal (64 caracteres). El token en claro nunca se persiste ni se registra en logs.';
