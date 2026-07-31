# 02 — Modelo de datos, RLS y motor de impuestos

Contrato de la base de datos. El SQL definitivo vive en `supabase/migrations/`; este documento
explica **por qué** cada pieza es como es.

---

## 1. Convenciones

- Claves primarias `uuid` (`gen_random_uuid()`). Nunca enteros secuenciales expuestos: revelan volumen
  de negocio y facilitan enumeración.
- Todas las tablas de negocio llevan `org_id uuid not null references organizations(id) on delete cascade`.
- `created_at` / `updated_at` `timestamptz` (nunca `timestamp` sin zona).
- Borrado lógico con `deleted_at timestamptz` en entidades que el usuario puede "eliminar" — un
  presupuesto borrado por error es una llamada a soporte.
- **Importes: `bigint` de céntimos.** Cantidades `numeric(12,3)`. Porcentajes `numeric(5,4)` (0.2100 = 21%).
- Enumerados como tipos Postgres (`create type`), no `text` libre.

---

## 2. Tablas

### 2.1 Identidad y organización

```
organizations
  id, name, slug (unique), country char(2) default 'ES', currency char(3) default 'EUR',
  legal_name, tax_id, email, phone, address jsonb, logo_path,
  brand jsonb          -- { accent, pdf_template, footer_note }
  tax_profile jsonb    -- ver §4
  settings jsonb,
  created_at, updated_at, deleted_at

memberships                          -- multi-tenant real desde el día 1 (D1)
  org_id, user_id, role org_role, invited_by, created_at
  PK (org_id, user_id)
  → org_role: 'owner' | 'admin' | 'member'

profiles
  user_id PK → auth.users(id), full_name, avatar_path,
  locale default 'es-ES', last_org_id, onboarded_at

invitations
  id, org_id, email, role, token_hash, expires_at, accepted_at, created_by
```

`memberships` es lo que hace que un electricista que crece a 4 empleados no requiera migración.

---

### 2.2 Datos de negocio del usuario

```
clients
  id, org_id, name, legal_name, tax_id, email, phone,
  address jsonb, client_type ('individual'|'company'|'retailer_re'),
  notes, tags text[],
  search_vector tsvector GENERATED,      -- name + tax_id + email
  created_by, created_at, updated_at, deleted_at

catalog_items                             -- materiales, mano de obra y servicios
  id, org_id, kind item_kind, sku, name, description,
  unit item_unit,                         -- 'unit'|'hour'|'m'|'m2'|'m3'|'kg'|'day'|'service'
  unit_cost_cents bigint,                 -- coste (margen calculable)
  unit_price_cents bigint not null,       -- PVP
  tax_rate numeric(5,4),                  -- null = usa el del perfil de la organización
  supplier, tags text[], is_active bool default true,
  usage_count int default 0,              -- alimenta el orden de sugerencias
  last_used_at,
  search_vector tsvector GENERATED,
  created_at, updated_at, deleted_at
  → item_kind: 'material' | 'labor' | 'service' | 'equipment' | 'other'
```

`unit_cost_cents` es opcional para el usuario pero **estratégico**: sin coste no hay margen, y el margen
por presupuesto es la analítica que justifica subir de plan.

---

### 2.3 Presupuestos

```
proposals
  id, org_id, client_id (null), created_by, assigned_to,
  number text,                     -- null mientras es borrador (§5)
  series_id,
  status proposal_status,          -- draft|ready|sent|viewed|accepted|rejected|expired|archived
  title, trade text,               -- oficio detectado
  currency char(3) default 'EUR',

  document jsonb not null,         -- §3: secciones narrativas + metadatos + schema_version
  tax_profile jsonb,               -- copia congelada del perfil al emitir (§4)

  subtotal_cents      bigint not null default 0,
  discount_cents      bigint not null default 0,
  tax_total_cents     bigint not null default 0,
  retention_cents     bigint not null default 0,   -- IRPF, se resta
  total_cents         bigint not null default 0,

  valid_until date, issued_at, sent_at, viewed_at, accepted_at, rejected_at,
  version int not null default 1,
  search_vector tsvector GENERATED,
  created_at, updated_at, deleted_at

  CHECK (total_cents = subtotal_cents - discount_cents + tax_total_cents - retention_cents)

proposal_lines
  id, proposal_id, org_id, position int not null,
  kind item_kind, description text not null,
  quantity numeric(12,3) not null,
  unit item_unit,
  unit_price_cents bigint not null,
  discount_pct numeric(5,4) default 0,
  tax_rate numeric(5,4) not null,
  line_total_cents bigint not null,          -- base, ya redondeada (§4)
  catalog_item_id (null) → catalog_items,    -- trazabilidad con el catálogo
  UNIQUE (proposal_id, position)

proposal_versions                            -- historial de cambios
  id, proposal_id, org_id, version int, snapshot jsonb not null,
  author_id, reason text, created_at
  UNIQUE (proposal_id, version)

proposal_templates
  id, org_id (null = plantilla global del sistema), trade, name,
  content jsonb, is_public bool, usage_count, created_at
```

El `CHECK` de totales es una red de seguridad barata: si alguna vez un cálculo produce un descuadre,
la transacción falla en vez de escribir datos económicos incorrectos.

---

### 2.4 Compartir y seguimiento

```
share_links
  id, proposal_id, org_id,
  token_hash text unique not null,     -- SHA-256; el token en claro NO se guarda
  password_hash text,                  -- opcional
  expires_at, revoked_at, created_by, created_at

share_events
  id, share_link_id, org_id,
  type share_event_type,               -- 'view'|'download'|'accept'|'reject'
  ip_hash text,                        -- hash con sal: analítica sin PII directa
  user_agent text, created_at
```

`ip_hash` en lugar de la IP: da capacidad de deduplicar visitas sin almacenar un dato personal
directamente identificable — decisión de RGPD tomada en el esquema, no parcheada después.

---

### 2.5 IA, uso y facturación

```
ai_sessions
  id, org_id, proposal_id (null), user_id, trade,
  state jsonb,        -- { slots, answers, asked, completeness }
  status ('active'|'completed'|'abandoned'), created_at, updated_at

ai_requests                       -- una fila por llamada al proveedor
  id, org_id, session_id (null), user_id,
  provider, model, purpose,       -- 'classify'|'extract'|'questions'|'generate'|'repair'
  input_tokens int, output_tokens int, cached_tokens int,
  cost_micros bigint,             -- millonésimas de euro: precisión sin float
  latency_ms int, status, error_code, created_at

subscriptions
  org_id PK, stripe_customer_id, stripe_subscription_id,
  plan ('free'|'pro'|'business'), status, seats int,
  current_period_start, current_period_end, cancel_at_period_end

usage_counters
  org_id, period_start date, metric ('proposals'|'ai_generations'|'emails'|'pdfs'),
  count int not null default 0
  PK (org_id, period_start, metric)

webhook_events                    -- idempotencia de Stripe
  id text PK,                     -- id del evento del proveedor
  provider, type, payload jsonb, processed_at

audit_log
  id, org_id, actor_id, action, entity_type, entity_id,
  diff jsonb, ip_hash, created_at
```

`ai_requests` con `cost_micros` es lo que permite responder a *"¿cuánto me cuesta atender a un cliente
de plan Pro?"*. Sin esa tabla, el precio de la suscripción se fija a ojo.

---

## 3. `proposals.document` — esquema versionado

Las líneas están normalizadas (D4); en `document` van las **secciones narrativas** y la trazabilidad:

```jsonc
{
  "schema_version": 1,
  "summary": "Instalación de termo eléctrico de 100 L …",
  "technical_description": "…",           // descripción técnica
  "scope_included": ["…"],                 // qué incluye
  "scope_excluded": ["…"],                 // qué NO incluye (evita discusiones)
  "estimated_duration": { "value": 3, "unit": "hours" },
  "warranty": { "months": 24, "text": "…" },
  "terms": ["…"],                          // condiciones
  "assumptions": ["…"],                    // supuestos si el usuario forzó la generación
  "notes_internal": "…",                   // no sale en el PDF
  "ai": {                                  // trazabilidad
    "trade": "fontaneria",
    "provider": "…", "model": "…",
    "session_id": "…",
    "generated_at": "…",
    "slots": { "capacidad_litros": 100, "tipo_trabajo": "sustitucion" }
  }
}
```

`schema_version` permite evolucionar el formato sin romper los presupuestos ya guardados: el lector
migra en memoria de v1 a v2 al abrir. Es el detalle que evita una migración masiva dentro de un año.

`scope_excluded` merece mención: la mayoría de conflictos entre profesional y cliente vienen de lo que
*no* estaba incluido. Que la IA lo haga explícito es una función de negocio, no un adorno.

---

## 4. Motor de impuestos

### 4.1 `TaxProfile`

```ts
type TaxProfile = {
  regime: 'peninsula' | 'canarias' | 'ceuta_melilla';
  defaultVatRate: 0.21 | 0.10 | 0.04 | 0.07 | 0;
  irpfRetention: 0 | 0.07 | 0.15;   // solo si el cliente es empresa/profesional
  equivalenceSurcharge: boolean;    // cliente minorista en recargo de equivalencia
  pricesIncludeTax: boolean;
};
```

### 4.2 Algoritmo (`computeTotals`, función pura y testeada)

```
1. Por cada línea:
     base = quantity × unit_price × (1 − discount_pct)
     base = redondear_half_up(base, 2)          → line_total_cents
2. Agrupar bases por tax_rate.
3. Por grupo:  cuota = redondear_half_up(base_grupo × tax_rate, 2)
   (si equivalenceSurcharge: se añade la cuota de RE del tipo correspondiente)
4. subtotal      = Σ bases
5. tax_total     = Σ cuotas
6. retention     = redondear_half_up(subtotal × irpfRetention, 2)
7. total         = subtotal − descuento_global + tax_total − retention
```

**Por qué se agrupa por tipo antes de aplicar el impuesto** y no se calcula el IVA línea a línea:
es el criterio de la AEAT y evita descuadres de ±1 cent en presupuestos con muchas líneas.
Es exactamente el tipo de detalle que separa un producto profesional de una demo.

**Tipos de IVA relevantes en el ICP:**

| Caso | Tipo |
|---|---|
| Servicio general | 21 % |
| Renovación/reparación en vivienda particular, antigüedad > 2 años, material ≤ 40 % de la base | 10 % |
| Canarias (IGIC general) | 7 % |
| Ceuta y Melilla | IPSI (varía por municipio) |

El sistema **sugiere** el tipo y muestra la condición legal aplicable, pero la responsabilidad fiscal es
del usuario. Debe aparecer un aviso claro: la herramienta no sustituye a un asesor fiscal.

---

## 5. Numeración de presupuestos

```
document_series
  id, org_id, kind ('proposal'|'invoice'), prefix text, year int,
  next_number int not null default 1
  UNIQUE (org_id, kind, year)
```

**Regla:** un borrador **no** consume número. El número se asigna al pasar a `ready`/`sent`, dentro de
una función `security definer` que hace `SELECT … FOR UPDATE` sobre la serie.

**Por qué importa:** si los borradores consumen numeración, la serie queda con huecos. En presupuestos
es feo; en facturas (la evolución natural del producto) es una infracción. Se resuelve ahora, cuesta cero.

---

## 6. RLS

### 6.1 Función auxiliar

```sql
create or replace function public.is_org_member(target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where org_id = target and user_id = (select auth.uid())
  );
$$;
```

`security definer` evita la recursión de RLS al consultar `memberships` desde la política de otra tabla.
`(select auth.uid())` en lugar de `auth.uid()` fuerza a Postgres a evaluarlo **una vez por consulta**
(*InitPlan*) en lugar de una vez por fila: en tablas grandes es la diferencia entre 8 ms y 800 ms.

### 6.2 Patrón por tabla

```sql
alter table proposals enable row level security;
alter table proposals force row level security;   -- ni el propietario de la tabla escapa

create policy proposals_select on proposals for select
  using (is_org_member(org_id) and deleted_at is null);

create policy proposals_insert on proposals for insert
  with check (is_org_member(org_id));

create policy proposals_update on proposals for update
  using (is_org_member(org_id)) with check (is_org_member(org_id));

create policy proposals_delete on proposals for delete
  using (public.has_org_role(org_id, array['owner','admin']));
```

Índice obligatorio: `memberships(user_id, org_id)` — lo usa **cada** política.

### 6.3 Acceso público por enlace (sin `service_role`)

```sql
create or replace function public.get_shared_proposal(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
  -- 1. hashea el token y busca el enlace
  -- 2. valida caducidad y revocación
  -- 3. devuelve SOLO ese presupuesto + líneas + datos públicos de la organización
$$;
```

Así la ruta pública nunca toca la `service_role key`. Si la función tiene un fallo, expone un
presupuesto; con `service_role` expondría la base entera. Es la diferencia entre un bug y un incidente.

### 6.4 Tests de RLS (obligatorios en CI)

Para cada tabla: crear dos organizaciones con datos, autenticarse como usuario de A e intentar
`select` / `update` / `delete` sobre filas de B. **Debe devolver 0 filas o error.** Sin estos tests,
un cambio de política pasa desapercibido hasta que un cliente ve datos de otro.

---

## 7. Índices

```sql
create index on memberships (user_id, org_id);
create index on proposals (org_id, created_at desc) where deleted_at is null;
create index on proposals (org_id, status)          where deleted_at is null;
create index on proposals (org_id, client_id)       where deleted_at is null;
create index on proposals using gin (search_vector);
create index on proposal_lines (proposal_id, position);
create index on catalog_items (org_id, kind, is_active);
create index on catalog_items using gin (search_vector);
create index on clients using gin (search_vector);
create index on ai_requests (org_id, created_at desc);
create unique index on share_links (token_hash);
```

Índices **parciales** (`where deleted_at is null`): más pequeños y más rápidos, porque las consultas de
la aplicación siempre excluyen lo borrado.

Búsqueda: `to_tsvector('spanish', unaccent(...))` en columna generada — así "reformas" encuentra
"Reformás" y "fontaneria" encuentra "fontanería". Sin `unaccent`, el buscador falla justo con las
palabras del mercado objetivo.
