# 08 — Mapa de 12 meses (no se ejecuta todavía)

> **No abras este documento para planificar hasta aprobar el examen de la semana 12.**
> Existe para que sepas hacia dónde vas, no para que empieces a mezclar contenidos. Mirar demasiado lejos es una de las formas más eficaces de no avanzar nada hoy.

## Dónde estarás al terminar las 12 semanas

Sistemas en producción, evidencia demostrable, primer dinero cobrado y una propuesta de cuatro cifras enviada. Eso es **el nivel de entrada profesional**: puedes cobrar por resolver problemas reales. No es todavía nivel élite, y quien te diga que sí en 3 meses te está mintiendo.

## Los meses 4–12: elegir dirección

En la semana 12 se toma **una** decisión, con los datos de los tres primeros meses, no con las ganas del momento. Cuatro caminos, y no se recorren dos a la vez:

### Camino A · Especialización vertical (el más rentable a corto plazo)
Eliges **un sector** (gestorías, clínicas, despachos legales, logística, ecommerce) y te conviertes en la persona que resuelve *ese* problema. Repites la misma solución con márgenes crecientes porque el segundo cliente cuesta la mitad de esfuerzo que el primero.
- **Meses 4–6:** 3–5 clientes del mismo nicho. Ingresos objetivo: 2.000–5.000 €/mes.
- **Meses 7–12:** producto empaquetado, precios más altos, mantenimiento recurrente. Objetivo: 5.000–12.000 €/mes.
- **Cuándo elegirlo:** si en las 12 semanas has cerrado clientes con facilidad y has visto el mismo problema repetido.

### Camino B · SaaS con IA (el más lento y el de mayor techo)
Solo tiene sentido si el Camino A te ha enseñado qué problema se repite y quién paga por resolverlo.
- **Meses 4–6:** MVP, autenticación, multi-tenant, pagos con Stripe, despliegue, control de costes por usuario.
- **Meses 7–12:** primeros usuarios de pago, retención, iteración. Objetivo realista: 500–3.000 €/mes recurrentes al mes 12.
- **Aviso:** la mayoría de SaaS de un solo fundador no llegan a 1.000 €/mes. No es motivo para no hacerlo; es motivo para no dejar los servicios mientras lo haces.

### Camino C · Empleo bien pagado
Si prefieres estabilidad y aprender dentro de un equipo con problemas a escala.
- **Meses 4–6:** portfolio afinado, contribuciones públicas, entrevistas técnicas, revisión de fundamentos de sistemas.
- **Objetivo (España):** AI engineer 45–70 k€ a nivel medio. Remoto internacional: 80–150 k€.
- **Ventaja escondida:** un año dentro de una empresa con volumen real te enseña cosas que un freelance tarda tres años en ver.

### Camino D · Agencia / equipo
Contratas o te asocias y escalas la entrega. Mayor ingreso potencial, y también un negocio distinto: pasas de ejecutar a vender y gestionar personas.
- **No lo elijas antes del mes 6.** Escalar un proceso de entrega que aún no dominas multiplica el caos, no los ingresos.

## Bloques técnicos que quedan pendientes para los meses 4–12

Por orden de valor esperado:

| Bloque | Cuándo | Por qué entonces |
|---|---|---|
| **Producción seria**: observabilidad, alertas, tests, CI/CD, control de costes por cliente | Mes 4 | En cuanto tengas 2+ sistemas de terceros funcionando |
| **Voice AI**: agentes de voz, telefonía, latencia, interrupciones | Mes 5 | Mercado real (agendado de citas, cualificación de leads), pero exige fundamentos ya sólidos |
| **Frontend suficiente**: React/Next.js para paneles y productos | Mes 5–6 | Cuando necesites que el cliente vea algo, no solo que funcione |
| **Pagos y multi-tenant**: Stripe, aislamiento de datos por cliente | Mes 6 | Solo si vas por el Camino B |
| **Sistemas multiagente** | Mes 7+ | Solo con un caso real de trabajo paralelo e independiente |
| **Fine-tuning y optimización de costes a escala** | Mes 8+ | Solo cuando el prompting toque techo con volumen alto y medido |
| **Seguridad de sistemas con IA**: inyección de prompts, fuga de datos, permisos | Mes 6+ | Se vuelve crítico en cuanto manejes datos sensibles de terceros |

## Lo que hace a alguien del 1% (y no es lo que crees)

No es saber más tecnologías. En este mercado, casi todo el mundo del 1% comparte cuatro cosas:

1. **Sabe elegir el problema.** Distingue el que da dinero del que solo es interesante.
2. **Sabe demostrar que su sistema funciona.** Con números, no con demos.
3. **Termina.** Entrega sistemas que aguantan meses sin él delante.
4. **Sabe explicárselo a quien firma el cheque.** Que no es técnico y no quiere serlo.

Las cuatro se entrenan en estas 12 semanas. Ninguna requiere aprender una tecnología más — que es justo lo que la lista de 40 herramientas te iba a hacer creer.
