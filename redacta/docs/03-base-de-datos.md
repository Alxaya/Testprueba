# 03 · Base de datos

PostgreSQL 16 con Prisma. El esquema está en
[`prisma/schema.prisma`](../prisma/schema.prisma) y está comentado.

---

## Modelo de datos

**16 tablas** agrupadas en cinco bloques:

### Autenticación
`User`, `Account`, `Session`, `VerificationToken` — estructura estándar de
Auth.js. `User.passwordHash` es nulo cuando la cuenta solo usa OAuth.

### Cliente y facturación
- `Organization` — la unidad de facturación y de aislamiento. **Todo cuelga de
  aquí.** Guarda una copia del estado de Stripe.
- `Membership` — relación usuario ↔ organización con su rol.
- `BrandProfile` — el contexto que se inyecta en cada prompt.
- `UsagePeriod` — contador agregado de consumo por periodo.

### Contenido
- `Project` — agrupación por marca, cliente o campaña.
- `Generation` — cada llamada al modelo: entrada, salida, tokens, coste y tiempo.
- `BlogPost` — el blog público.

### Analítica
`AnalyticsEvent` — eventos propios sin identificadores persistentes.

### Operativa
`EmailLog`, `ProcessedWebhook`, `FeatureFlag`, `AuditLog`.

---

## Reglas del modelo

1. **Borrado en cascada desde `Organization`.** Dar de baja a un cliente es una
   sola operación y cumple el derecho de supresión del RGPD.
2. **Importes en céntimos (`Int`).** Nunca coma flotante para dinero.
3. **Índices donde se consulta de verdad:** `(organizationId, createdAt)` en
   generaciones, `(name, createdAt)` en eventos, `(published, publishedAt)` en el
   blog.
4. **`ProcessedWebhook` garantiza idempotencia.** Stripe reintenta hasta recibir
   un 2xx; sin esta tabla, un reintento podría duplicar efectos.

---

## Desarrollo

```bash
npm run db:up          # PostgreSQL con Docker
npm run db:push        # sincroniza el esquema sin migración
npm run db:seed        # datos de ejemplo
npm run db:studio      # explorador visual
```

`db:push` es cómodo mientras el esquema se mueve mucho. **No lo uses en
producción**: no deja historial ni permite revertir.

---

## Producción: migraciones

```bash
# 1. Al cambiar el esquema, en local:
npm run db:migrate -- --name descripcion_del_cambio

# 2. Revisa el SQL generado en prisma/migrations/

# 3. En el despliegue:
npm run db:deploy
```

Reglas para no romper producción:

- **Nunca edites una migración ya aplicada.** Crea otra encima.
- **Los cambios destructivos van en dos pasos.** Para renombrar una columna:
  añadir la nueva → desplegar → copiar datos → dejar de usar la vieja →
  desplegar → borrarla en una migración posterior.
- **Revisa el SQL antes de aplicarlo.** Prisma a veces propone recrear una tabla
  cuando bastaría con alterarla.

---

## Copias de seguridad

Sin copias, un error de migración es pérdida total de clientes.

```bash
# Copia
pg_dump "$DATABASE_URL" --format=custom --file=redacta-$(date +%F).dump

# Restauración
pg_restore --clean --if-exists --dbname="$DATABASE_URL" redacta-2026-01-15.dump
```

Recomendación mínima: copia diaria automática con 30 días de retención, y **una
prueba de restauración al mes**. Una copia que no se ha restaurado nunca no es
una copia.

Los proveedores gestionados (Neon, Supabase, RDS) traen esto de serie: actívalo.

---

## Consultas útiles para dar soporte

```sql
-- Consumo del mes por cliente
SELECT o.name, u.generations, u.words, u."costCents"
FROM "UsagePeriod" u JOIN "Organization" o ON o.id = u."organizationId"
WHERE u."periodStart" >= date_trunc('month', now())
ORDER BY u.generations DESC;

-- Generaciones fallidas recientes y su motivo
SELECT "createdAt", "errorMessage", type
FROM "Generation" WHERE status = 'FAILED'
ORDER BY "createdAt" DESC LIMIT 20;

-- Cuentas con cobro pendiente
SELECT name, "subscriptionStatus", "stripeCurrentPeriodEnd"
FROM "Organization" WHERE "subscriptionStatus" = 'PAST_DUE';

-- Tamaño de las tablas (para saber qué purgar)
SELECT relname, pg_size_pretty(pg_total_relation_size(relid)) AS tamano
FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC;
```

---

## Crecimiento

`AnalyticsEvent` es la tabla que más crece. El trabajo `cleanup` borra los
eventos de más de 180 días automáticamente. Si el tráfico se dispara, las
opciones son particionar por fecha o mover la analítica a un almacén aparte.
