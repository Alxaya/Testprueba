-- ============================================================================
-- 0008 · Funciones transaccionales
-- ============================================================================
-- Aquí vive lo que DEBE ser atómico o DEBE ser inalcanzable desde el cliente.
-- Todo lo demás se implementa en TypeScript, donde se testea mejor.

-- ────────────────────────────────────────────────────────────────────────────
-- Alta de organización
-- ────────────────────────────────────────────────────────────────────────────
-- Cuatro escrituras que deben ocurrir juntas o no ocurrir: organización,
-- membresía de propietario, suscripción gratuita y serie de numeración del año.
-- Hacerlo desde la aplicación con cuatro llamadas deja usuarios huérfanos en
-- organizaciones sin propietario si la segunda falla.

create or replace function public.create_organization(p_name text, p_slug text)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := (select auth.uid());
  v_org  public.organizations;
begin
  if v_user is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  if p_slug !~ '^[a-z0-9][a-z0-9-]{1,60}$' then
    raise exception 'invalid_slug' using errcode = '22023';
  end if;

  insert into public.organizations (name, slug)
  values (btrim(p_name), p_slug)
  returning * into v_org;

  insert into public.memberships (org_id, user_id, role)
  values (v_org.id, v_user, 'owner');

  insert into public.subscriptions (org_id, plan)
  values (v_org.id, 'free');

  insert into public.document_series (org_id, kind, prefix, year)
  values (v_org.id, 'proposal', 'PRE', extract(year from now())::integer);

  update public.profiles set last_org_id = v_org.id where user_id = v_user;

  return v_org;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Asignación de número de presupuesto
-- ────────────────────────────────────────────────────────────────────────────
-- El `for update` sobre la serie serializa a los usuarios concurrentes de una
-- misma organización. Sin él, dos personas pulsando "enviar" a la vez obtienen
-- el mismo número — y en la evolución natural del producto (facturas) eso es
-- una infracción, no un detalle estético.
--
-- Idempotente: si el presupuesto ya tiene número, lo devuelve sin consumir otro.
--
-- Numerar y salir de borrador son EL MISMO acto y ocurren en la misma
-- sentencia. Separarlos deja un instante en el que el presupuesto está numerado
-- y sigue siendo borrador, estado que la restricción `proposals_number_requires_status`
-- prohíbe con razón: un documento numerado ya es un documento emitido.

create or replace function public.assign_proposal_number(p_proposal_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org      uuid;
  v_existing text;
  v_status   public.proposal_status;
  v_year     integer := extract(year from now())::integer;
  v_series   public.document_series;
  v_number   text;
begin
  select org_id, number, status into v_org, v_existing, v_status
  from public.proposals
  where id = p_proposal_id and deleted_at is null;

  if v_org is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if not public.is_org_member(v_org) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_existing is not null then
    return v_existing;
  end if;

  -- Crea la serie del año en curso si aún no existe (primer documento de enero).
  insert into public.document_series (org_id, kind, prefix, year)
  values (v_org, 'proposal', 'PRE', v_year)
  on conflict (org_id, kind, year) do nothing;

  select * into v_series
  from public.document_series
  where org_id = v_org and kind = 'proposal' and year = v_year
  for update;

  v_number := format('%s-%s-%s', v_series.prefix, v_year, lpad(v_series.next_number::text, 4, '0'));

  update public.document_series
  set next_number = next_number + 1
  where id = v_series.id;

  update public.proposals
  set number    = v_number,
      series_id = v_series.id,
      issued_at = coalesce(issued_at, now()),
      -- Promoción de estado en la misma sentencia. Un presupuesto que ya está
      -- enviado o aceptado conserva el suyo: numerar no debe hacerlo retroceder.
      status    = case when v_status = 'draft' then 'ready' else v_status end
  where id = p_proposal_id;

  return v_number;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Lectura pública por enlace compartido
-- ────────────────────────────────────────────────────────────────────────────
-- Decisión D8/D10 (docs/00): la ruta pública NO usa la clave `service_role`.
-- Si esta función tuviera un fallo, expone un presupuesto; con `service_role`
-- expondría la base entera. Es la diferencia entre un bug y un incidente.
--
-- Devuelve exclusivamente los campos que deben verse en la página pública:
-- ni notas internas, ni costes, ni identificadores de usuario.

create or replace function public.get_shared_proposal(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_link public.share_links;
  v_prop public.proposals;
  v_org  public.organizations;
begin
  if p_token is null or length(p_token) < 20 then
    return null;
  end if;

  v_hash := encode(sha256(convert_to(p_token, 'utf8')), 'hex');

  select * into v_link from public.share_links where token_hash = v_hash;

  if v_link.id is null
     or v_link.revoked_at is not null
     or (v_link.expires_at is not null and v_link.expires_at < now())
  then
    return null;
  end if;

  select * into v_prop from public.proposals where id = v_link.proposal_id and deleted_at is null;
  if v_prop.id is null then
    return null;
  end if;

  select * into v_org from public.organizations where id = v_prop.org_id;

  return jsonb_build_object(
    'shareLinkId', v_link.id,
    'requiresPassword', v_link.password_hash is not null,
    'organization', jsonb_build_object(
      'name', v_org.name,
      'legalName', v_org.legal_name,
      'taxId', v_org.tax_id,
      'email', v_org.email,
      'phone', v_org.phone,
      'address', v_org.address,
      'logoPath', v_org.logo_path,
      'brand', v_org.brand
    ),
    'proposal', jsonb_build_object(
      'id', v_prop.id,
      'number', v_prop.number,
      'status', v_prop.status,
      'title', v_prop.title,
      'currency', v_prop.currency,
      -- Se excluye `notes_internal`: es la nota privada del profesional.
      'document', v_prop.document - 'notes_internal',
      'subtotalCents', v_prop.subtotal_cents,
      'discountCents', v_prop.discount_cents,
      'taxTotalCents', v_prop.tax_total_cents,
      'retentionCents', v_prop.retention_cents,
      'totalCents', v_prop.total_cents,
      'validUntil', v_prop.valid_until,
      'issuedAt', v_prop.issued_at
    ),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', l.position,
        'kind', l.kind,
        'description', l.description,
        'quantity', l.quantity,
        'unit', l.unit,
        'unitPriceCents', l.unit_price_cents,
        'discountPct', l.discount_pct,
        'taxRate', l.tax_rate,
        'lineTotalCents', l.line_total_cents
      ) order by l.position)
      from public.proposal_lines l
      where l.proposal_id = v_prop.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Separada de la anterior para que la lectura pueda permanecer STABLE: mezclar
-- lectura y escritura obligaría a marcarla VOLATILE y perdería optimizaciones.
create or replace function public.record_share_event(
  p_share_link_id uuid,
  p_type public.share_event_type,
  p_ip_hash text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.share_links
  where id = p_share_link_id and revoked_at is null
    and (expires_at is null or expires_at > now());

  if v_org is null then
    return;  -- silencioso a propósito: no confirmar la existencia del enlace
  end if;

  insert into public.share_events (share_link_id, org_id, type, ip_hash, user_agent)
  values (p_share_link_id, v_org, p_type, p_ip_hash, left(p_user_agent, 400));

  if p_type = 'view' then
    update public.share_links
    set view_count = view_count + 1, last_viewed_at = now()
    where id = p_share_link_id;

    update public.proposals p
    set status = 'viewed', viewed_at = coalesce(p.viewed_at, now())
    from public.share_links s
    where s.id = p_share_link_id and p.id = s.proposal_id and p.status = 'sent';
  end if;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Privilegios de ejecución
-- ────────────────────────────────────────────────────────────────────────────
-- Postgres concede EXECUTE a PUBLIC por defecto. En funciones SECURITY DEFINER
-- eso es una escalada de privilegios silenciosa: hay que revocarlo siempre y
-- conceder solo al rol que lo necesita.

revoke execute on function public.create_organization(text, text) from public;
revoke execute on function public.assign_proposal_number(uuid) from public;
revoke execute on function public.get_shared_proposal(text) from public;
revoke execute on function public.record_share_event(uuid, public.share_event_type, text, text) from public;

grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.assign_proposal_number(uuid) to authenticated;

-- Estas dos sí son públicas: son el camino del cliente final que abre el enlace
-- sin tener cuenta.
grant execute on function public.get_shared_proposal(text) to anon, authenticated;
grant execute on function public.record_share_event(uuid, public.share_event_type, text, text) to anon, authenticated;
