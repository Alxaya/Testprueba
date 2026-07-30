import { PrismaClient } from "@prisma/client";
import { PRODUCT_CATALOG } from "../src/lib/valuation/catalog";

/**
 * Carga el catálogo de referencia en la base de datos.
 *
 * Es idempotente: se puede ejecutar tantas veces como haga falta y actualiza los
 * modelos existentes en lugar de duplicarlos. No crea usuarios, análisis ni
 * ningún dato de ejemplo: la base arranca vacía de contenido de usuario.
 */
const prisma = new PrismaClient();

async function main() {
  console.log(`Cargando ${PRODUCT_CATALOG.length} modelos de referencia…`);

  let created = 0;
  let updated = 0;

  for (const product of PRODUCT_CATALOG) {
    const existing = await prisma.productReference.findUnique({
      where: { slug: product.slug },
      select: { id: true },
    });

    await prisma.productReference.upsert({
      where: { slug: product.slug },
      create: {
        slug: product.slug,
        category: product.category,
        brand: product.brand,
        model: product.model,
        releaseYear: product.releaseYear,
        msrpCents: product.msrpCents,
        storageTiers: product.storageTiers,
        aliases: product.aliases,
        source: product.source,
      },
      update: {
        category: product.category,
        brand: product.brand,
        model: product.model,
        releaseYear: product.releaseYear,
        msrpCents: product.msrpCents,
        storageTiers: product.storageTiers,
        aliases: product.aliases,
        source: product.source,
      },
    });

    if (existing) updated++;
    else created++;
  }

  const byCategory = await prisma.productReference.groupBy({
    by: ["category"],
    _count: { id: true },
  });

  console.log(`Catálogo listo: ${created} nuevos, ${updated} actualizados.`);
  for (const row of byCategory) {
    console.log(`  · ${row.category}: ${row._count.id} modelos`);
  }
}

main()
  .catch((error) => {
    console.error("Error cargando el catálogo:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
