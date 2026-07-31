-- ============================================================================
-- 0009 · Búsqueda y listado de presupuestos
-- ============================================================================
-- HALLAZGO DE LA AUDITORÍA DE F0 — motivo de que esta función exista.
--
-- Con RLS activo, Postgres trata la tabla como una barrera de seguridad: las
-- condiciones de la política deben evaluarse ANTES que las del usuario, salvo
-- que el operador del usuario esté marcado LEAKPROOF (podría filtrar
-- información de filas que el usuario no debería ver, a través del mensaje de
-- error o del tiempo de respuesta).
--
--     uuid_eq      (=)   → LEAKPROOF = true   → el índice btree SÍ se usa
--     ts_match_vq  (@@)  → LEAKPROOF = false  → el índice GIN NO se usa
--
-- Consecuencia medida sobre 40.000 filas: la búsqueda a texto completo degrada
-- a recorrido secuencial (~120 ms y creciendo linealmente), mientras que el
-- mismo plan sin RLS usa el GIN en ~4 ms.
--
-- `alter function ... leakproof` requiere superusuario y no está disponible en
-- Supabase, así que la solución correcta es la misma que en `get_shared_proposal`:
-- una función SECURITY DEFINER que comprueba la autorización UNA vez, al entrar,
-- y después ejecuta la consulta ya acotada a esa organización.
--
-- Esto NO debilita la seguridad: la comprobación de pertenencia es explícita,
-- y `p_org_id` acota el resultado a esa organización. Lo que se elimina es la
-- reevaluación por fila, que es justo lo que impedía usar el índice.

create or replace function public.search_proposals(
  p_org_id       uuid,
  p_query        text default null,
  p_statuses     public.proposal_status[] default null,
  p_client_id    uuid default null,
  p_trade        text default null,
  p_from         date default null,
  p_to           date default null,
  p_limit        integer default 25,
  -- Paginación por cursor (keyset), no OFFSET: con OFFSET, la página 200 obliga
  -- a Postgres a leer y descartar 5.000 filas. El coste crece con la profundidad;
  -- con cursor es constante, y además no se salta ni repite filas cuando alguien
  -- inserta un presupuesto entre dos peticiones de página.
  --
  -- El cursor es TEXTO OPACO, no una fecha. Motivo (bug detectado en F0):
  -- `timestamptz` guarda microsegundos, pero los clientes JavaScript lo reciben
  -- como `Date`, que solo tiene milisegundos. Al devolverlo, el valor llega
  -- truncado hacia abajo y la comparación `<` descarta filas que sí tocaban:
  -- la segunda página sale VACÍA. Como texto, el valor viaja íntegro.
  p_cursor       text default null
)
returns table (
  id           uuid,
  number       text,
  title        text,
  status       public.proposal_status,
  trade        text,
  client_id    uuid,
  client_name  text,
  total_cents  bigint,
  currency     char(3),
  valid_until  date,
  created_at   timestamptz,
  total_count  bigint,
  -- Se devuelve para pasarlo tal cual en la siguiente petición.
  next_cursor  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tsquery      tsquery;
  v_cursor_parts text[];
  v_cursor_at    timestamptz;
  v_cursor_id    uuid;
begin
  if not public.is_org_member(p_org_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Cota dura: un `limit` enorme enviado desde el cliente no debe poder
  -- convertirse en una descarga completa de la base.
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 100);

  if p_query is not null and btrim(p_query) <> '' then
    v_tsquery := plainto_tsquery('spanish', public.immutable_unaccent(p_query));
  end if;

  if p_cursor is not null and btrim(p_cursor) <> '' then
    v_cursor_parts := string_to_array(p_cursor, '|');
    if array_length(v_cursor_parts, 1) <> 2 then
      raise exception 'invalid_cursor' using errcode = '22023';
    end if;
    -- Un cursor corrupto debe dar un error claro, no una página silenciosamente
    -- vacía que el usuario interpretaría como "no hay más resultados".
    begin
      v_cursor_at := v_cursor_parts[1]::timestamptz;
      v_cursor_id := v_cursor_parts[2]::uuid;
    exception when others then
      raise exception 'invalid_cursor' using errcode = '22023';
    end;
  end if;

  return query
  with filtered as (
    select p.*
    from public.proposals p
    where p.org_id = p_org_id
      and p.deleted_at is null
      and (v_tsquery is null or p.search_vector @@ v_tsquery)
      and (p_statuses  is null or p.status = any (p_statuses))
      and (p_client_id is null or p.client_id = p_client_id)
      and (p_trade     is null or p.trade = p_trade)
      and (p_from      is null or p.created_at >= p_from)
      and (p_to        is null or p.created_at < (p_to + 1))
  )
  select
    f.id, f.number, f.title, f.status, f.trade, f.client_id,
    c.name as client_name,
    f.total_cents, f.currency, f.valid_until, f.created_at,
    count(*) over () as total_count,
    -- `to_char` con .US conserva los microsegundos que un `Date` de JavaScript
    -- perdería. Es lo que hace que la paginación no se rompa en silencio.
    to_char(f.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' || f.id::text as next_cursor
  from filtered f
  left join public.clients c on c.id = f.client_id
  where
    v_cursor_at is null
    or (f.created_at, f.id) < (v_cursor_at, v_cursor_id)
  order by f.created_at desc, f.id desc
  limit p_limit;
end;
$$;

comment on function public.search_proposals is
  'Listado y búsqueda de presupuestos. SECURITY DEFINER para que el índice GIN sea utilizable bajo RLS (ver cabecera de 0009).';

-- Índice compuesto para el orden por cursor: `created_at desc, id desc` debe
-- resolverse leyendo el índice, sin paso de ordenación.
create index if not exists proposals_keyset_idx
  on public.proposals (org_id, created_at desc, id desc)
  where deleted_at is null;

revoke execute on function public.search_proposals(
  uuid, text, public.proposal_status[], uuid, text, date, date, integer, text
) from public;

grant execute on function public.search_proposals(
  uuid, text, public.proposal_status[], uuid, text, date, date, integer, text
) to authenticated;
