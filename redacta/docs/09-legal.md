# 09 · Legal

> **Este documento no es asesoramiento jurídico.** Los textos incluidos son una
> base de partida conforme a la LSSI-CE y el RGPD, pero deben completarse con los
> datos reales del titular y revisarse por un profesional antes de facturar.

---

## Bloqueante: completar antes de cobrar

Los textos están en [`src/content/legal.ts`](../src/content/legal.ts). Busca
`[PENDIENTE]` y rellena:

- Nombre o razón social del titular
- NIF / CIF
- Domicilio fiscal
- Email de contacto real (ahora es un ejemplo)
- Proveedor de alojamiento y base de datos (en la política de privacidad)

```bash
grep -rn "PENDIENTE" src/content/legal.ts
```

Además, ajusta el email en `src/lib/site.ts` (`site.email`).

---

## Qué está cubierto

| Documento | URL | Cubre |
| --- | --- | --- |
| Aviso legal | `/legal/aviso-legal` | Art. 10 LSSI-CE, condiciones de uso |
| Privacidad | `/legal/privacidad` | RGPD: datos, base legal, encargados, derechos |
| Cookies | `/legal/cookies` | Cookies técnicas y por qué no hay banner |
| Términos | `/legal/terminos` | Contratación, pagos, cancelación, desistimiento |

---

## Decisiones y su justificación

### No hay banner de cookies

Solo se usan cookies **técnicas necesarias** (sesión y CSRF), exentas del deber de
consentimiento previo según el artículo 22.2 de la LSSI-CE. La analítica es
propia, agregada y sin identificadores persistentes.

> ⚠️ **Si añades Google Analytics, un píxel de Meta o cualquier herramienta de
> terceros, esta exención desaparece** y hay que implementar consentimiento previo
> con bloqueo hasta la aceptación.

### Derecho de desistimiento

Los términos incluyen la renuncia expresa del artículo 103.m del RDL 1/2007, que
aplica a servicios digitales de ejecución inmediata. El cliente la acepta al
contratar.

### Datos enviados al modelo

La política de privacidad declara a Anthropic como encargado del tratamiento e
indica que el contenido **no se usa para entrenar modelos**. Verifica que esto
sigue siendo cierto en las condiciones vigentes de tu proveedor antes de
publicarlo.

### Derechos RGPD implementados

| Derecho | Cómo se ejerce |
| --- | --- |
| Acceso y portabilidad | `/api/export` — descarga en JSON desde Ajustes |
| Supresión | Ajustes → Eliminar cuenta (borrado real en cascada) |
| Rectificación | Ajustes → editar datos |
| Oposición / limitación | Por email al responsable |

**No son promesas de documento: están implementados.** La eliminación de cuenta
borra la organización y, en cascada, contenido, proyectos, uso y eventos.

---

## Obligaciones fiscales (España)

Consúltalo con una gestoría; a título orientativo:

- Alta en el censo de empresarios (modelo 036/037) antes de facturar.
- Alta de autónomo o constitución de sociedad.
- IVA: 21 % en servicios digitales a particulares en España. Para clientes de
  otros países de la UE cambian las reglas (ventanilla única / inversión del
  sujeto pasivo). **Stripe Tax lo resuelve si lo configuras.**
- Conservación de facturas durante los plazos legales (Stripe las guarda, pero la
  responsabilidad es tuya).

---

## Lista de comprobación

- [ ] Datos fiscales en `src/content/legal.ts`
- [ ] Email de contacto real en `src/lib/site.ts`
- [ ] Proveedor de alojamiento declarado en la política de privacidad
- [ ] Textos revisados por un asesor
- [ ] Alta censal y fiscal completada
- [ ] Stripe Tax configurado
- [ ] Registro de actividades de tratamiento (obligatorio con más de 250
      empleados o tratamientos de riesgo; recomendable en cualquier caso)
