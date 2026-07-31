/**
 * Validación del catálogo base de oficios.
 *
 * Motivo de existir: `content` es JSONB, y Postgres no valida su interior. Un
 * precio escrito como cadena (`'450'` en vez de `450`) se almacena tan feliz, y
 * el fallo solo aparece cuando el motor de precios multiplica una cadena por una
 * cantidad — es decir, en un presupuesto que el usuario ya está enviando a su
 * cliente.
 *
 * Este test es lo que convierte una estructura sin esquema en una estructura con
 * contrato verificado.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';

const KINDS = new Set(['material', 'labor', 'service', 'equipment', 'other']);
const UNITS = new Set(['unit', 'hour', 'day', 'm', 'm2', 'm3', 'kg', 'l', 'service']);

interface CatalogEntry {
  kind: unknown;
  name: unknown;
  unit: unknown;
  unit_price_cents: unknown;
}

interface TemplateRow {
  trade: string;
  name: string;
  content: {
    schema_version?: unknown;
    warranty_months?: unknown;
    terms?: unknown;
    catalog?: CatalogEntry[];
  };
}

let client: Client | undefined;
let templates: TemplateRow[] = [];

function db(): Client {
  if (!client) throw new Error('La conexión no se ha establecido.');
  return client;
}

beforeAll(async () => {
  client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const { rows } = await db().query<TemplateRow>(
    'select trade, name, content from public.proposal_templates where org_id is null order by trade',
  );
  templates = rows;
}, 30_000);

afterAll(async () => {
  await client?.end();
});

describe('catálogo base de oficios', () => {
  it('cubre los nueve oficios del público objetivo', () => {
    expect(templates.map((t) => t.trade).sort()).toEqual([
      'carpinteria',
      'cerrajeria',
      'climatizacion',
      'electricidad',
      'fontaneria',
      'jardineria',
      'limpieza',
      'pintura',
      'reformas',
    ]);
  });

  it('todas las plantillas llevan versión de esquema, garantía y condiciones', () => {
    for (const template of templates) {
      expect(template.content.schema_version, template.trade).toBe(1);
      expect(typeof template.content.warranty_months, template.trade).toBe('number');
      expect(Array.isArray(template.content.terms), template.trade).toBe(true);
      expect((template.content.terms as unknown[]).length, template.trade).toBeGreaterThanOrEqual(
        2,
      );
    }
  });

  it('cada entrada del catálogo cumple el contrato', () => {
    for (const template of templates) {
      const catalog = template.content.catalog ?? [];
      expect(catalog.length, template.trade).toBeGreaterThanOrEqual(4);

      for (const entry of catalog) {
        const label = `${template.trade} → ${String(entry.name)}`;

        expect(KINDS.has(entry.kind as string), `${label}: kind inválido`).toBe(true);
        expect(UNITS.has(entry.unit as string), `${label}: unidad inválida`).toBe(true);
        expect(typeof entry.name, `${label}: nombre`).toBe('string');

        // El fallo concreto que motivó este test: precio como cadena.
        expect(typeof entry.unit_price_cents, `${label}: el precio debe ser número`).toBe('number');
        expect(Number.isInteger(entry.unit_price_cents), `${label}: céntimos enteros`).toBe(true);
        expect(entry.unit_price_cents as number, `${label}: precio positivo`).toBeGreaterThan(0);

        // Cota de cordura: nada del catálogo base debería superar los 5.000 €.
        // Un cero de más convertiría una referencia en un disparate que la IA
        // tomaría por buena.
        expect(entry.unit_price_cents as number, `${label}: precio desorbitado`).toBeLessThan(
          500_000,
        );
      }
    }
  });

  it('las plantillas globales son públicas y de solo lectura', async () => {
    const { rows } = await db().query<{ n: string }>(
      'select count(*)::int as n from public.proposal_templates where org_id is null and not is_public',
    );
    // La restricción `templates_global_is_public` lo garantiza; el test
    // documenta la intención y detectaría que alguien la retire.
    expect(Number(rows[0]!.n)).toBe(0);
  });
});
