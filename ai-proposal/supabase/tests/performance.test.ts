/**
 * Regresión de rendimiento del listado de presupuestos.
 *
 * ORIGEN DE ESTE TEST — hallazgo de la auditoría de F0:
 *
 * Consultar `proposals` SIN filtrar explícitamente por `org_id` y dejar que RLS
 * haga el filtrado produce un Seq Scan. La política es una llamada a función
 * (`is_org_member(org_id)`), y Postgres no puede usar un índice sobre el
 * resultado de una función: tiene que evaluarla fila a fila.
 *
 *     sin `where org_id = $1` → Seq Scan,     251 ms sobre 50.000 filas
 *     con `where org_id = $1` → Index Scan,  0,82 ms   (≈300× más rápido)
 *
 * De ahí el invariante de la aplicación (docs/01 §6):
 *
 *   RLS es la frontera de SEGURIDAD; el `where org_id = ...` explícito es lo
 *   que da el RENDIMIENTO. Los dos, siempre, en toda consulta.
 *
 * Es un fallo silencioso: funciona perfecto con datos de prueba y se degrada
 * cuando el producto tiene tracción — justo el peor momento. Por eso se verifica
 * en CI en lugar de confiarlo a la memoria de quien escriba la próxima consulta.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const ROWS_PER_ORG = 20_000;

let client: Client | undefined;
let orgId = '';
let userId = '';
let foreignOrgId = '';

function db(): Client {
  if (!client) throw new Error('La conexión no se ha establecido.');
  return client;
}

/** Ejecuta una consulta con la identidad de un usuario autenticado y RLS activo. */
async function queryAsUser<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const session = new Client({ connectionString: process.env.DATABASE_URL });
  await session.connect();
  try {
    await session.query('begin');
    await session.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    await session.query('set local role authenticated');
    const { rows } = await session.query<T>(sql, params);
    return rows;
  } finally {
    await session.query('rollback').catch(() => undefined);
    await session.end();
  }
}

/** Plan sin RLS: refleja lo que ocurre dentro de una función SECURITY DEFINER. */
async function explainAsSuperuser(sql: string, params: unknown[]): Promise<string> {
  const { rows } = await db().query<{ 'QUERY PLAN': string }>(
    `explain (analyze, costs off) ${sql}`,
    params,
  );
  return rows.map((r) => r['QUERY PLAN']).join('\n');
}

/** Devuelve el plan de ejecución de una consulta vista como usuario autenticado. */
async function explainAsUser(sql: string, params: unknown[]): Promise<string> {
  const session = new Client({ connectionString: process.env.DATABASE_URL });
  await session.connect();
  try {
    await session.query('begin');
    await session.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({ sub: userId, role: 'authenticated' }),
    ]);
    await session.query('set local role authenticated');

    const { rows } = await session.query<{ 'QUERY PLAN': string }>(
      `explain (analyze, costs off) ${sql}`,
      params,
    );
    return rows.map((r) => r['QUERY PLAN']).join('\n');
  } finally {
    await session.query('rollback').catch(() => undefined);
    await session.end();
  }
}

beforeAll(async () => {
  client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const {
    rows: [user],
  } = await db().query<{ id: string }>(
    `insert into auth.users (email) values ('perf@example.test') returning id`,
  );
  userId = user!.id;
  await db().query('insert into public.profiles (user_id) values ($1)', [userId]);

  await db().query('select set_config($1, $2, false)', [
    'request.jwt.claims',
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  const {
    rows: [org],
  } = await db().query<{ id: string }>(
    `select id from public.create_organization('Perf', 'org-perf')`,
  );
  orgId = org!.id;

  // Una segunda organización con el mismo volumen: sin datos ajenos, la política
  // no tendría nada que descartar y el test daría un resultado engañosamente bueno.
  const {
    rows: [other],
  } = await db().query<{ id: string }>(
    `insert into public.organizations (name, slug) values ('Ajena', 'org-ajena') returning id`,
  );

  foreignOrgId = other!.id;

  for (const target of [orgId, foreignOrgId]) {
    await db().query(
      `insert into public.proposals (org_id, title, trade, document, subtotal_cents, tax_total_cents, total_cents)
       select $1, 'Presupuesto ' || g, 'fontaneria', jsonb_build_object('schema_version', 1), g * 100, g * 21, g * 121
       from generate_series(1, $2) g`,
      [target, ROWS_PER_ORG],
    );
  }

  // Unas pocas filas con un término raro y acentuado. Buscar algo que aparece
  // en las 40.000 filas no probaría nada: el planificador elige (con razón) un
  // recorrido secuencial porque el LIMIT se cubre de inmediato. Un índice solo
  // demuestra su valor con un término selectivo.
  await db().query(
    `insert into public.proposals (org_id, title, trade, document, subtotal_cents, tax_total_cents, total_cents)
     select $1, 'Instalación de climatización en ático', 'climatizacion',
            jsonb_build_object('schema_version', 1), 100000, 21000, 121000
     from generate_series(1, 3)`,
    [orgId],
  );

  await db().query('analyze public.proposals');
  await db().query('analyze public.memberships');
}, 120_000);

afterAll(async () => {
  await client?.end();
});

describe(`listado con ${String(ROWS_PER_ORG * 2)} presupuestos`, () => {
  it('usa el índice cuando la consulta filtra por org_id', async () => {
    const plan = await explainAsUser(
      `select id, number, title, status, total_cents, created_at
       from public.proposals
       where org_id = $1 and deleted_at is null
       order by created_at desc
       limit 25`,
      [orgId],
    );

    expect(plan).toContain('proposals_org_created_idx');
    expect(plan).not.toContain('Seq Scan on proposals');

    const executionMs = Number(/Execution Time: ([\d.]+) ms/.exec(plan)?.[1] ?? Infinity);
    // Umbral holgado frente a los ~0,8 ms medidos: los runners de CI son
    // lentos e irregulares, y un test que falla por ruido acaba ignorándose.
    // Lo que se vigila aquí es el salto de magnitud, no el milisegundo.
    expect(executionMs).toBeLessThan(50);
  });

  it('sin filtro explícito por org_id degrada a recorrido secuencial', async () => {
    // No es un test de "algo está roto": documenta ejecutablemente POR QUÉ el
    // invariante existe. Si algún día Postgres o la política cambian y esto
    // deja de ser cierto, conviene enterarse y revisar la regla.
    const plan = await explainAsUser(
      `select id from public.proposals
       where deleted_at is null
       order by created_at desc
       limit 25`,
      [],
    );

    expect(plan).toContain('Seq Scan on proposals');
  });

  it('la consulta directa NO puede usar el índice GIN bajo RLS', async () => {
    // Documenta el hallazgo que obligó a crear `search_proposals` (migración
    // 0009): el operador `@@` no es LEAKPROOF, así que con RLS activo Postgres
    // no puede aplicarlo antes que la condición de la política, y el índice GIN
    // queda inutilizable. Si algún día esto dejase de ser cierto, conviene
    // enterarse y simplificar en consecuencia.
    const plan = await explainAsUser(
      `select id from public.proposals
       where org_id = $1
         and search_vector @@ plainto_tsquery('spanish', public.immutable_unaccent($2))
       limit 25`,
      [orgId, 'climatizacion atico'],
    );

    expect(plan).not.toContain('proposals_search_idx');
  });

  it('search_proposals resuelve la búsqueda con el índice GIN', async () => {
    // EXPLAIN sobre una función PL/pgSQL solo muestra "Function Scan": el plan
    // interno no se expone. Se verifica en dos partes:
    //   1. que el índice es utilizable cuando RLS no bloquea el operador
    //      (que es la situación dentro de una función SECURITY DEFINER), y
    //   2. que el tiempo real de la RPC corresponde a un plan indexado.
    const innerPlan = await explainAsSuperuser(
      `select id from public.proposals
       where org_id = $1
         and search_vector @@ plainto_tsquery('spanish', public.immutable_unaccent($2))
       limit 25`,
      [orgId, 'climatizacion atico'],
    );
    expect(innerPlan).toContain('proposals_search_idx');

    const started = performance.now();
    await queryAsUser(`select * from public.search_proposals($1, $2)`, [
      orgId,
      'climatizacion atico',
    ]);
    const elapsed = performance.now() - started;

    // Sobre 40.000 filas, un recorrido secuencial ronda los 120 ms y crece de
    // forma lineal. El umbral vigila el salto de magnitud, no el milisegundo.
    expect(elapsed).toBeLessThan(50);
  });

  it('search_proposals devuelve resultados correctos y el total', async () => {
    const rows = await queryAsUser<{ title: string; total_count: string }>(
      `select title, total_count from public.search_proposals($1, $2)`,
      [orgId, 'climatizacion atico'],
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]!.title).toContain('ático');
    // `total_count` permite pintar "3 resultados" sin una segunda consulta.
    expect(Number(rows[0]!.total_count)).toBe(3);
  });

  it('search_proposals rechaza organizaciones ajenas', async () => {
    await expect(
      queryAsUser('select * from public.search_proposals($1)', [foreignOrgId]),
    ).rejects.toThrow(/forbidden/);
  });

  it('la paginación por cursor no repite ni salta filas', async () => {
    const first = await queryAsUser<{ id: string; next_cursor: string }>(
      `select id, next_cursor from public.search_proposals($1, null, null, null, null, null, null, 10)`,
      [orgId],
    );
    expect(first).toHaveLength(10);

    const second = await queryAsUser<{ id: string }>(
      `select id from public.search_proposals($1, null, null, null, null, null, null, 10, $2)`,
      [orgId, first[9]!.next_cursor],
    );
    expect(second).toHaveLength(10);

    // Sin solapamiento. Es exactamente lo que OFFSET rompe cuando alguien inserta
    // una fila entre dos peticiones de página.
    const firstIds = new Set(first.map((r) => r.id));
    expect(second.some((r) => firstIds.has(r.id))).toBe(false);
  });

  it('el cursor conserva los microsegundos', async () => {
    // Regresión del bug de F0: todas estas filas se insertaron en la misma
    // transacción, así que comparten `created_at` al milisegundo. Si el cursor
    // viajase como `Date` de JavaScript, la segunda página saldría vacía y el
    // usuario vería "no hay más resultados" con 39.990 pendientes.
    const [row] = await queryAsUser<{ next_cursor: string }>(
      `select next_cursor from public.search_proposals($1, null, null, null, null, null, null, 1)`,
      [orgId],
    );

    expect(row!.next_cursor).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z\|[0-9a-f-]{36}$/,
    );
  });

  it('un cursor corrupto falla de forma explícita', async () => {
    // Nunca una página vacía silenciosa: eso se interpreta como fin de lista.
    await expect(
      queryAsUser(
        `select * from public.search_proposals($1, null, null, null, null, null, null, 10, $2)`,
        [orgId, 'basura'],
      ),
    ).rejects.toThrow(/invalid_cursor/);
  });
});
