-- ============================================================================
-- 0007 · Row Level Security
-- ============================================================================
-- Decisión D8 (docs/00): la frontera de seguridad vive en la base de datos, no
-- en la aplicación. Un `WHERE org_id = ?` olvidado en un solo endpoint debe
-- devolver cero filas, no los datos de otro cliente. La seguridad falla cerrada.
--
-- FORCE ROW LEVEL SECURITY, además de ENABLE: sin FORCE, el propietario de la
-- tabla (que es quien ejecuta las migraciones) las salta silenciosamente, y los
-- tests podrían pasar dando una falsa sensación de seguridad.
--
-- Cobertura verificada por supabase/tests/rls.test.ts: cualquier tabla nueva sin
-- RLS hace fallar el CI.

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'organizations', 'memberships', 'invitations',
    'clients', 'catalog_items',
    'document_series', 'proposals', 'proposal_lines', 'proposal_versions', 'proposal_templates',
    'share_links', 'share_events',
    'ai_sessions', 'ai_requests',
    'subscriptions', 'usage_counters', 'webhook_events', 'audit_log'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
  end loop;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Perfiles: cada usuario, solo el suyo.
-- ────────────────────────────────────────────────────────────────────────────
create policy profiles_select on public.profiles for select using (user_id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert with check (user_id = (select auth.uid()));
create policy profiles_update on public.profiles for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ────────────────────────────────────────────────────────────────────────────
-- Organizaciones
-- ────────────────────────────────────────────────────────────────────────────
create policy organizations_select on public.organizations for select
  using (public.is_org_member(id) and deleted_at is null);

-- Cualquier usuario autenticado puede crear su organización; la pertenencia se
-- crea en la misma transacción vía RPC (0008).
create policy organizations_insert on public.organizations for insert
  with check ((select auth.uid()) is not null);

create policy organizations_update on public.organizations for update
  using (public.has_org_role(id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(id, array['owner', 'admin']::public.org_role[]));

create policy organizations_delete on public.organizations for delete
  using (public.has_org_role(id, array['owner']::public.org_role[]));

-- ────────────────────────────────────────────────────────────────────────────
-- Membresías
-- ────────────────────────────────────────────────────────────────────────────
-- Aquí `is_org_member()` no es una comodidad: es obligatorio. Una subconsulta
-- directa sobre `memberships` dentro de su propia política vuelve a activar esa
-- misma política y Postgres aborta con "infinite recursion detected in policy
-- for relation memberships". La función es SECURITY DEFINER, así que su
-- consulta interna no dispara RLS y el ciclo se corta.
--
-- Detectado por supabase/tests/rls.test.ts. Es exactamente la clase de fallo
-- que una revisión visual da por bueno.
create policy memberships_select on public.memberships for select
  using (user_id = (select auth.uid()) or public.is_org_member(org_id));

create policy memberships_insert on public.memberships for insert
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

create policy memberships_update on public.memberships for update
  using (public.has_org_role(org_id, array['owner']::public.org_role[]))
  with check (public.has_org_role(org_id, array['owner']::public.org_role[]));

create policy memberships_delete on public.memberships for delete
  using (
    public.has_org_role(org_id, array['owner']::public.org_role[])
    or user_id = (select auth.uid())  -- abandonar una organización
  );

create policy invitations_all on public.invitations for all
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]))
  with check (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- ────────────────────────────────────────────────────────────────────────────
-- Entidades de negocio: patrón uniforme por pertenencia a la organización.
-- ────────────────────────────────────────────────────────────────────────────
-- Generado en bucle en lugar de copiado 8 veces: una política escrita a mano
-- con un `org_id` mal tecleado es una fuga de datos, y revisando 40 bloques
-- casi idénticos nadie la detecta.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'catalog_items', 'document_series',
    'proposals', 'proposal_lines', 'proposal_versions',
    'share_links', 'share_events', 'ai_sessions'
  ]
  loop
    execute format($f$
      create policy %1$I_select on public.%1$I for select using (public.is_org_member(org_id));
      create policy %1$I_insert on public.%1$I for insert with check (public.is_org_member(org_id));
      create policy %1$I_update on public.%1$I for update
        using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
      create policy %1$I_delete on public.%1$I for delete
        using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));
    $f$, t);
  end loop;
end;
$$;

-- Plantillas: las globales (org_id null) son de solo lectura para todos.
create policy proposal_templates_select on public.proposal_templates for select
  using ((org_id is null and is_public) or public.is_org_member(org_id));

create policy proposal_templates_insert on public.proposal_templates for insert
  with check (org_id is not null and public.is_org_member(org_id));

create policy proposal_templates_update on public.proposal_templates for update
  using (org_id is not null and public.is_org_member(org_id))
  with check (org_id is not null and public.is_org_member(org_id));

create policy proposal_templates_delete on public.proposal_templates for delete
  using (org_id is not null and public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- ────────────────────────────────────────────────────────────────────────────
-- Tablas de solo lectura para el usuario
-- ────────────────────────────────────────────────────────────────────────────
-- Escribirlas es competencia exclusiva del servidor (webhooks y RPC). Sin
-- políticas de INSERT/UPDATE, ningún cliente autenticado puede alterar su plan
-- ni borrar su propio rastro de auditoría.

create policy ai_requests_select    on public.ai_requests    for select using (public.is_org_member(org_id));
create policy subscriptions_select  on public.subscriptions  for select using (public.is_org_member(org_id));
create policy usage_counters_select on public.usage_counters for select using (public.is_org_member(org_id));

create policy audit_log_select on public.audit_log for select
  using (public.has_org_role(org_id, array['owner', 'admin']::public.org_role[]));

-- `webhook_events` no lleva ninguna política: con RLS activo y sin políticas,
-- nadie salvo `service_role` puede tocarla. Es exactamente lo que se quiere.

-- ────────────────────────────────────────────────────────────────────────────
-- Privilegios de tabla
-- ────────────────────────────────────────────────────────────────────────────
-- RLS filtra filas, pero GRANT decide si la tabla es siquiera alcanzable. Las
-- dos capas juntas: `anon` no puede leer nada de negocio ni aunque una política
-- futura se escribiera mal.
revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.organizations, public.memberships, public.invitations,
  public.clients, public.catalog_items, public.document_series,
  public.proposals, public.proposal_lines, public.proposal_versions, public.proposal_templates,
  public.share_links, public.share_events, public.ai_sessions
to authenticated;

grant select on
  public.ai_requests, public.subscriptions, public.usage_counters, public.audit_log
to authenticated;
