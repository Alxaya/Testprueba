/**
 * Tests de aislamiento multi-tenant.
 *
 * Es la batería más importante del proyecto. Una regresión de RLS no produce un
 * error visible: produce que un cliente vea los datos de otro, en silencio,
 * hasta que alguien lo denuncia. Por eso estas comprobaciones son obligatorias
 * en CI y ninguna tabla nueva puede saltárselas (ver el test de cobertura).
 *
 * Se ejecutan contra un Postgres real con el esquema `auth` emulado
 * (supabase/tests/00-bootstrap.sql), no contra un doble de prueba: las
 * políticas RLS son SQL, y solo Postgres sabe si son correctas.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;

/** Superusuario: se salta RLS. Solo para preparar y limpiar datos. */
let admin: Client | undefined;

/** Acceso comprobado: si `beforeAll` falló, el mensaje señala la causa real. */
function db(): Client {
  if (!admin) throw new Error('La conexión de administración no se ha establecido.');
  return admin;
}

const orgA = { id: '', userId: '' };
const orgB = { id: '', userId: '' };
let proposalA = '';
let proposalB = '';

/**
 * Ejecuta consultas adoptando la identidad de un usuario autenticado.
 *
 * Dos detalles imprescindibles para que el test sea válido:
 *  1. `set local role authenticated` — el propietario de las tablas se saltaría
 *     las políticas y el test pasaría siempre, dando falsa seguridad.
 *  2. Todo dentro de una transacción que se revierte, para que los tests no se
 *     contaminen entre sí.
 */
async function asUser<T>(userId: string, run: (query: Query) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    await client.query('set local role authenticated');
    return await run((text, params) => client.query(text, params));
  } finally {
    await client.query('rollback').catch(() => undefined);
    await client.end();
  }
}

type Query = (
  text: string,
  params?: unknown[],
) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;

/** Igual que `asUser`, pero como visitante anónimo (enlace público). */
async function asAnon<T>(run: (query: Query) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('set local role anon');
    return await run((text, params) => client.query(text, params));
  } finally {
    await client.query('rollback').catch(() => undefined);
    await client.end();
  }
}

async function seedOrg(name: string, slug: string) {
  const {
    rows: [user],
  } = await db().query<{ id: string }>('insert into auth.users (email) values ($1) returning id', [
    `${slug}@example.test`,
  ]);
  const userId = user!.id;

  await db().query('insert into public.profiles (user_id, full_name) values ($1, $2)', [
    userId,
    name,
  ]);

  // Vía RPC real, no INSERT directo: así el test también cubre que
  // `create_organization` deja la organización en un estado coherente.
  // `is_local = false`: la conexión admin no está dentro de una transacción, y
  // un ajuste local se descartaría antes de la siguiente sentencia.
  await db().query('select set_config($1, $2, false)', [
    'request.jwt.claims',
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  const {
    rows: [org],
  } = await db().query<{ id: string }>('select id from public.create_organization($1, $2)', [
    name,
    slug,
  ]);

  const orgId = org!.id;

  await db().query(`insert into public.clients (org_id, name, created_by) values ($1, $2, $3)`, [
    orgId,
    `Cliente de ${name}`,
    userId,
  ]);
  await db().query(
    `insert into public.catalog_items (org_id, kind, name, unit, unit_price_cents)
     values ($1, 'material', $2, 'unit', 4500)`,
    [orgId, `Material de ${name}`],
  );

  const {
    rows: [proposal],
  } = await db().query<{ id: string }>(
    `insert into public.proposals
       (org_id, created_by, title, trade, document, subtotal_cents, tax_total_cents, total_cents)
     values ($1, $2, $3, 'fontaneria', jsonb_build_object('schema_version', 1, 'notes_internal', 'PRIVADO'),
             10000, 2100, 12100)
     returning id`,
    [orgId, userId, `Presupuesto de ${name}`],
  );
  const proposalId = proposal!.id;

  await db().query(
    `insert into public.proposal_lines
       (proposal_id, org_id, position, kind, description, quantity, unit, unit_price_cents, tax_rate, line_total_cents)
     values ($1, $2, 0, 'material', 'Termo eléctrico 100 L', 1, 'unit', 10000, 0.21, 10000)`,
    [proposalId, orgId],
  );

  await db().query(
    `insert into public.proposal_versions (proposal_id, org_id, version, snapshot, author_id, reason)
     values ($1, $2, 1, jsonb_build_object('schema_version', 1), $3, 'creación')`,
    [proposalId, orgId, userId],
  );

  await db().query(
    `insert into public.ai_sessions (org_id, user_id, trade) values ($1, $2, 'fontaneria')`,
    [orgId, userId],
  );
  await db().query(
    `insert into public.ai_requests (org_id, provider, model, purpose, cost_micros)
     values ($1, 'anthropic', 'test-model', 'generate', 12345)`,
    [orgId],
  );
  await db().query(
    `insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id)
     values ($1, $2, 'proposal.created', 'proposal', $3)`,
    [orgId, userId, proposalId],
  );

  return { id: orgId, userId, proposalId };
}

beforeAll(async () => {
  if (!connectionString)
    throw new Error('DATABASE_URL no está definida: los tests de RLS necesitan una base real.');

  admin = new Client({ connectionString });
  await admin.connect();

  const a = await seedOrg('Fontanería A', 'org-a');
  const b = await seedOrg('Electricidad B', 'org-b');

  Object.assign(orgA, { id: a.id, userId: a.userId });
  Object.assign(orgB, { id: b.id, userId: b.userId });
  proposalA = a.proposalId;
  proposalB = b.proposalId;
}, 30_000);

afterAll(async () => {
  await admin?.end();
});

// ────────────────────────────────────────────────────────────────────────────

describe('cobertura de RLS', () => {
  it('todas las tablas de public tienen RLS activo y forzado', async () => {
    const { rows } = await db().query<{ tablename: string }>(`
      select c.relname as tablename
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and (c.relrowsecurity = false or c.relforcerowsecurity = false)
      order by 1
    `);

    // Si este test falla, alguien ha añadido una tabla sin protegerla.
    expect(rows.map((r) => r.tablename)).toEqual([]);
  });

  it('anon no tiene privilegios sobre ninguna tabla de negocio', async () => {
    const { rows } = await db().query<{ table_name: string }>(`
      select distinct table_name
      from information_schema.role_table_grants
      where grantee = 'anon' and table_schema = 'public'
      order by 1
    `);
    expect(rows.map((r) => r.table_name)).toEqual([]);
  });
});

describe('aislamiento entre organizaciones', () => {
  const isolated = [
    'clients',
    'catalog_items',
    'document_series',
    'proposals',
    'proposal_lines',
    'proposal_versions',
    'ai_sessions',
    'ai_requests',
    'subscriptions',
    'audit_log',
  ] as const;

  it.each(isolated)('el usuario de A no ve filas de B en %s', async (table) => {
    const visible = await asUser(orgA.userId, async (query) => {
      const { rows } = await query(
        `select count(*)::int as n from public.${table} where org_id = $1`,
        [orgB.id],
      );
      return rows[0]!['n'];
    });
    expect(visible).toBe(0);
  });

  it.each(isolated)('el usuario de A sí ve sus propias filas en %s', async (table) => {
    // Contrapartida imprescindible: sin ella, una política que bloquease TODO
    // también pasaría los tests de aislamiento.
    const visible = await asUser(orgA.userId, async (query) => {
      const { rows } = await query(
        `select count(*)::int as n from public.${table} where org_id = $1`,
        [orgA.id],
      );
      return rows[0]!['n'];
    });
    expect(visible).toBeGreaterThan(0);
  });

  it('el usuario de A no puede modificar un presupuesto de B', async () => {
    const affected = await asUser(orgA.userId, async (query) => {
      const result = await query('update public.proposals set title = $1 where id = $2', [
        'secuestrado',
        proposalB,
      ]);
      return result.rowCount;
    });
    expect(affected).toBe(0);
  });

  it('el usuario de A no puede borrar un presupuesto de B', async () => {
    const affected = await asUser(orgA.userId, async (query) => {
      const result = await query('delete from public.proposals where id = $1', [proposalB]);
      return result.rowCount;
    });
    expect(affected).toBe(0);
  });

  it('el usuario de A no puede insertar filas en la organización B', async () => {
    await expect(
      asUser(orgA.userId, (query) =>
        query('insert into public.clients (org_id, name) values ($1, $2)', [orgB.id, 'Infiltrado']),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('el usuario de A no ve la organización B', async () => {
    const visible = await asUser(orgA.userId, async (query) => {
      const { rows } = await query(
        'select count(*)::int as n from public.organizations where id = $1',
        [orgB.id],
      );
      return rows[0]!['n'];
    });
    expect(visible).toBe(0);
  });

  it('el usuario de A no ve las membresías de B', async () => {
    const visible = await asUser(orgA.userId, async (query) => {
      const { rows } = await query(
        'select count(*)::int as n from public.memberships where org_id = $1',
        [orgB.id],
      );
      return rows[0]!['n'];
    });
    expect(visible).toBe(0);
  });

  it('un perfil ajeno no es visible', async () => {
    const visible = await asUser(orgA.userId, async (query) => {
      const { rows } = await query(
        'select count(*)::int as n from public.profiles where user_id = $1',
        [orgB.userId],
      );
      return rows[0]!['n'];
    });
    expect(visible).toBe(0);
  });

  it('webhook_events es inalcanzable para un usuario autenticado', async () => {
    await expect(
      asUser(orgA.userId, (query) => query('select * from public.webhook_events')),
    ).rejects.toThrow(/permission denied/i);
  });

  it('un usuario no puede cambiar el plan de su propia suscripción', async () => {
    await expect(
      asUser(orgA.userId, (query) =>
        query(`update public.subscriptions set plan = 'business' where org_id = $1`, [orgA.id]),
      ),
    ).rejects.toThrow(/permission denied/i);
  });
});

describe('numeración de presupuestos', () => {
  // Como usuario autenticado, no como superusuario: `assign_proposal_number`
  // comprueba la pertenencia con `is_org_member()`, así que ejecutarla sin
  // identidad probaría algo distinto de lo que ocurre en producción.
  it('asigna números correlativos y es idempotente', async () => {
    const result = await asUser(orgA.userId, async (query) => {
      const first = await query('select public.assign_proposal_number($1) as n', [proposalA]);
      const repeated = await query('select public.assign_proposal_number($1) as n', [proposalA]);

      const { rows: created } = await query(
        `insert into public.proposals (org_id, title, document)
         values ($1, 'Segundo', jsonb_build_object('schema_version', 1)) returning id`,
        [orgA.id],
      );
      const second = await query('select public.assign_proposal_number($1) as n', [
        created[0]!['id'],
      ]);

      return {
        first: first.rows[0]!['n'] as string,
        repeated: repeated.rows[0]!['n'] as string,
        second: second.rows[0]!['n'] as string,
      };
    });

    expect(result.first).toMatch(/^PRE-\d{4}-\d{4}$/);
    // Segunda llamada sobre el mismo presupuesto: mismo número, sin consumir
    // otro de la serie. Si no fuese idempotente, un doble clic dejaría huecos.
    expect(result.repeated).toBe(result.first);

    const sequence = (value: string) => Number(value.split('-')[2]);
    expect(sequence(result.second)).toBe(sequence(result.first) + 1);
  });

  it('numerar saca el presupuesto de borrador en la misma operación', async () => {
    const status = await asUser(orgA.userId, async (query) => {
      await query('select public.assign_proposal_number($1)', [proposalA]);
      const { rows } = await query('select status from public.proposals where id = $1', [
        proposalA,
      ]);
      return rows[0]!['status'];
    });
    expect(status).toBe('ready');
  });

  it('un usuario ajeno no puede numerar un presupuesto de otra organización', async () => {
    await expect(
      asUser(orgA.userId, (query) =>
        query('select public.assign_proposal_number($1)', [proposalB]),
      ),
    ).rejects.toThrow(/forbidden/);
  });

  it('un presupuesto numerado no puede volver a borrador', async () => {
    await expect(
      asUser(orgA.userId, async (query) => {
        await query('select public.assign_proposal_number($1)', [proposalA]);
        return query(`update public.proposals set status = 'draft' where id = $1`, [proposalA]);
      }),
    ).rejects.toThrow(/proposals_number_requires_status/);
  });
});

describe('integridad económica', () => {
  it('rechaza totales descuadrados', async () => {
    await expect(
      db().query(
        `insert into public.proposals (org_id, title, document, subtotal_cents, tax_total_cents, total_cents)
         values ($1, 'Descuadrado', jsonb_build_object('schema_version', 1), 10000, 2100, 99999)`,
        [orgA.id],
      ),
    ).rejects.toThrow(/proposals_totals_consistent/);
  });

  it('rechaza cantidades no positivas en una línea', async () => {
    await expect(
      db().query(
        `insert into public.proposal_lines
           (proposal_id, org_id, position, description, quantity, unit_price_cents, tax_rate, line_total_cents)
         values ($1, $2, 99, 'Cantidad inválida', 0, 100, 0.21, 0)`,
        [proposalA, orgA.id],
      ),
    ).rejects.toThrow(/quantity/);
  });
});

describe('enlace público compartido', () => {
  const token = 'a'.repeat(48);

  async function createLink(overrides: { expiresAt?: string | null; revoked?: boolean } = {}) {
    const {
      rows: [link],
    } = await db().query<{ id: string }>(
      `insert into public.share_links (proposal_id, org_id, token_hash, expires_at, revoked_at)
       values ($1, $2, encode(sha256(convert_to($3, 'utf8')), 'hex'), $4, $5)
       returning id`,
      [
        proposalB,
        orgB.id,
        token,
        overrides.expiresAt ?? null,
        overrides.revoked ? new Date().toISOString() : null,
      ],
    );
    return link!.id;
  }

  it('un visitante anónimo obtiene el presupuesto con un token válido', async () => {
    const linkId = await createLink();

    const payload = await asAnon(async (query) => {
      const { rows } = await query('select public.get_shared_proposal($1) as data', [token]);
      return rows[0]!['data'] as Record<string, unknown>;
    });

    expect(payload).not.toBeNull();
    expect((payload['proposal'] as Record<string, unknown>)['title']).toBe(
      'Presupuesto de Electricidad B',
    );
    expect(payload['lines']).toHaveLength(1);

    await db().query('delete from public.share_links where id = $1', [linkId]);
  });

  it('nunca expone las notas internas', async () => {
    const linkId = await createLink();

    const document = await asAnon(async (query) => {
      const { rows } = await query('select public.get_shared_proposal($1) as data', [token]);
      const data = rows[0]!['data'] as Record<string, unknown>;
      return (data['proposal'] as Record<string, unknown>)['document'] as Record<string, unknown>;
    });

    // El presupuesto sembrado sí tiene notas internas: si aparecieran aquí,
    // se estarían filtrando al cliente final del profesional.
    expect(document['notes_internal']).toBeUndefined();
    expect(document['schema_version']).toBe(1);

    await db().query('delete from public.share_links where id = $1', [linkId]);
  });

  it('un enlace revocado no devuelve nada', async () => {
    const linkId = await createLink({ revoked: true });
    const payload = await asAnon(async (query) => {
      const { rows } = await query('select public.get_shared_proposal($1) as data', [token]);
      return rows[0]!['data'];
    });
    expect(payload).toBeNull();
    await db().query('delete from public.share_links where id = $1', [linkId]);
  });

  it('un enlace caducado no devuelve nada', async () => {
    const linkId = await createLink({ expiresAt: new Date(Date.now() - 60_000).toISOString() });
    const payload = await asAnon(async (query) => {
      const { rows } = await query('select public.get_shared_proposal($1) as data', [token]);
      return rows[0]!['data'];
    });
    expect(payload).toBeNull();
    await db().query('delete from public.share_links where id = $1', [linkId]);
  });

  it('un token inexistente no devuelve nada', async () => {
    const payload = await asAnon(async (query) => {
      const { rows } = await query('select public.get_shared_proposal($1) as data', [
        'z'.repeat(48),
      ]);
      return rows[0]!['data'];
    });
    expect(payload).toBeNull();
  });

  it('el anónimo no puede leer la tabla de enlaces directamente', async () => {
    await expect(asAnon((query) => query('select * from public.share_links'))).rejects.toThrow(
      /permission denied/i,
    );
  });
});

describe('buscador', () => {
  it('encuentra ignorando acentos y mayúsculas', async () => {
    // El mercado objetivo escribe "fontaneria" sin tilde. Si el buscador no lo
    // resuelve, falla justo con las palabras que más se usan.
    await db().query(
      `insert into public.clients (org_id, name) values ($1, 'Reformás Peña S.L.')`,
      [orgA.id],
    );

    const { rows } = await db().query<{ n: string }>(
      `select count(*)::int as n from public.clients
       where org_id = $1
         and search_vector @@ plainto_tsquery('spanish', public.immutable_unaccent('reformas pena'))`,
      [orgA.id],
    );

    expect(Number(rows[0]!.n)).toBeGreaterThan(0);
  });
});
