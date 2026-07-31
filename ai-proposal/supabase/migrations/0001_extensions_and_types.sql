-- ============================================================================
-- 0001 · Extensiones, tipos enumerados y utilidades compartidas
-- ============================================================================
-- Ver docs/02 para la justificación de cada decisión de modelado.

create extension if not exists unaccent with schema extensions;

-- ────────────────────────────────────────────────────────────────────────────
-- unaccent inmutable
-- ────────────────────────────────────────────────────────────────────────────
-- `unaccent(text)` es STABLE, no IMMUTABLE, porque su diccionario podría
-- cambiar. Eso impide usarlo en una columna GENERATED, que es justo lo que
-- necesitamos para que el buscador encuentre "fontanería" escribiendo
-- "fontaneria" — imprescindible en un producto en español.
--
-- La solución estándar es fijar el diccionario explícitamente y envolverlo en
-- una función marcada IMMUTABLE. Es seguro mientras no se modifique el
-- diccionario `unaccent`; si algún día se modificara, habría que reindexar.
create or replace function public.immutable_unaccent(txt text)
returns text
language sql
immutable
strict
parallel safe
set search_path = extensions, public
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, txt);
$$;

comment on function public.immutable_unaccent(text) is
  'unaccent con diccionario fijo, marcada IMMUTABLE para poder usarse en columnas GENERATED.';

-- Constructor del vector de búsqueda. Centralizado para que todas las tablas
-- indexen exactamente igual y el comportamiento del buscador sea uniforme.
create or replace function public.build_search_vector(variadic parts text[])
returns tsvector
language sql
immutable
parallel safe
set search_path = public
as $$
  select to_tsvector('spanish', public.immutable_unaccent(coalesce(array_to_string(parts, ' '), '')));
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- updated_at automático
-- ────────────────────────────────────────────────────────────────────────────
-- En el trigger y no en la aplicación: así ninguna ruta de escritura (RPC,
-- server action, script de mantenimiento) puede olvidarlo.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Tipos enumerados
-- ────────────────────────────────────────────────────────────────────────────
-- Enums de Postgres en vez de `text` libre: el valor inválido se rechaza en la
-- base de datos, no se descubre al pintar una insignia sin color.

create type public.org_role as enum ('owner', 'admin', 'member');

create type public.item_kind as enum ('material', 'labor', 'service', 'equipment', 'other');

create type public.item_unit as enum ('unit', 'hour', 'day', 'm', 'm2', 'm3', 'kg', 'l', 'service');

create type public.proposal_status as enum (
  'draft',     -- borrador: no consume número de serie
  'ready',     -- listo para enviar: ya numerado
  'sent',
  'viewed',    -- el cliente final ha abierto el enlace
  'accepted',
  'rejected',
  'expired',
  'archived'
);

create type public.client_type as enum (
  'individual',   -- particular
  'company',      -- empresa o profesional → puede aplicar retención de IRPF
  'retailer_re'   -- comerciante en recargo de equivalencia
);

create type public.tax_regime as enum ('peninsula', 'canarias', 'ceuta_melilla');

create type public.share_event_type as enum ('view', 'download', 'accept', 'reject');

create type public.ai_purpose as enum ('classify', 'extract', 'questions', 'generate', 'repair');

create type public.ai_request_status as enum ('ok', 'invalid_output', 'provider_error', 'timeout', 'aborted');

create type public.billing_plan as enum ('free', 'pro', 'business');

create type public.usage_metric as enum ('proposals', 'ai_generations', 'emails', 'pdfs');

create type public.document_kind as enum ('proposal', 'invoice');
