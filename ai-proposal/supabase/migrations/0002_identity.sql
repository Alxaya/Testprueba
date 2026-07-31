-- ============================================================================
-- 0002 · Identidad y multi-tenancy
-- ============================================================================
-- Decisión D1 (docs/00): toda entidad de negocio pertenece a una ORGANIZACIÓN,
-- nunca a un usuario. Es lo que permite que un autónomo que crece a 4 empleados
-- no requiera una migración de esquema en producción.

create table public.profiles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  avatar_path   text,
  locale        text not null default 'es-ES',
  last_org_id   uuid,
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Datos de perfil. auth.users queda como fuente de verdad de credenciales.';

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 120),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),

  -- Datos fiscales que aparecen impresos en el PDF.
  legal_name  text,
  tax_id      text,
  email       text,
  phone       text,
  address     jsonb not null default '{}'::jsonb,

  country     char(2) not null default 'ES',
  currency    char(3) not null default 'EUR',
  logo_path   text,

  -- { accent, pdf_template, footer_note } — ver docs/02 §2.1
  brand       jsonb not null default '{}'::jsonb,

  -- Perfil fiscal por defecto (docs/02 §4). Se copia congelado en cada
  -- presupuesto al emitirlo, para que un cambio futuro de régimen no altere
  -- documentos ya enviados a un cliente.
  tax_profile jsonb not null default jsonb_build_object(
    'regime', 'peninsula',
    'defaultVatRate', 0.21,
    'irpfRetention', 0,
    'equivalenceSurcharge', false,
    'pricesIncludeTax', false
  ),

  settings    jsonb not null default '{}'::jsonb,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.memberships (
  org_id     uuid not null references public.organizations (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.org_role not null default 'member',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Índice crítico de rendimiento: lo recorre CADA política RLS del sistema
-- (docs/02 §6). Sin él, toda la aplicación se degrada a la vez.
create index memberships_user_org_idx on public.memberships (user_id, org_id);

create table public.invitations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations (id) on delete cascade,
  email      text not null,
  role       public.org_role not null default 'member',
  -- Solo el hash: una filtración de la base de datos no debe entregar
  -- invitaciones utilizables.
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index invitations_pending_idx
  on public.invitations (org_id, lower(email))
  where accepted_at is null;

-- `last_org_id` se declara después de organizations para poder referenciarla.
alter table public.profiles
  add constraint profiles_last_org_fk
  foreign key (last_org_id) references public.organizations (id) on delete set null;

create trigger profiles_updated_at      before update on public.profiles      for each row execute function public.set_updated_at();
create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- Funciones de autorización
-- ────────────────────────────────────────────────────────────────────────────
-- SECURITY DEFINER es obligatorio aquí: una política RLS sobre `proposals` que
-- consultase `memberships` dispararía la RLS de `memberships`, que a su vez
-- consulta `memberships`… recursión infinita. Con DEFINER la consulta interna
-- se ejecuta sin RLS y el bucle se corta.
--
-- `(select auth.uid())` en lugar de `auth.uid()` no es cosmético: obliga a
-- Postgres a evaluarlo UNA VEZ por consulta (InitPlan) en lugar de una vez por
-- fila. En una tabla de 100k filas es la diferencia entre 8 ms y 800 ms.

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = target_org
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed public.org_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.org_id = target_org
      and m.user_id = (select auth.uid())
      and m.role = any (allowed)
  );
$$;

comment on function public.is_org_member(uuid) is
  'Pertenencia del usuario autenticado a una organización. SECURITY DEFINER para evitar recursión de RLS.';

revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.has_org_role(uuid, public.org_role[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, public.org_role[]) to authenticated;
