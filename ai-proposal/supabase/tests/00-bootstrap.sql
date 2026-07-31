-- ============================================================================
-- Bootstrap para ejecutar las migraciones contra un Postgres estándar
-- ============================================================================
-- En Supabase, el esquema `auth` y los roles `anon` / `authenticated` /
-- `service_role` ya existen. En CI se usa un contenedor `postgres:16` normal,
-- que es un orden de magnitud más rápido y ligero que levantar el stack de
-- Supabase con Docker, así que aquí se recrea el mínimo imprescindible.
--
-- Este fichero NO forma parte de las migraciones y nunca se aplica a producción.

create schema if not exists extensions;
create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema public, extensions, auth to anon, authenticated, service_role;

-- Réplica mínima de auth.users: solo lo que referencian las claves foráneas.
create table if not exists auth.users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique,
  created_at    timestamptz not null default now()
);

-- Implementación real de Supabase: lee el `sub` del JWT desde la configuración
-- de sesión. Los tests la fijan con `set_config('request.jwt.claims', ...)`.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'anon'
  );
$$;

grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;

-- Utilidad para los tests: adopta la identidad de un usuario concreto.
-- `set local` limita el efecto a la transacción en curso.
create or replace function public.test_login(p_user uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end;
$$;
