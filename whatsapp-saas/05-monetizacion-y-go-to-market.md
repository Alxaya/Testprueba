# 05 — Monetización y go-to-market

> Puntos 17 y 20 del encargo: sistema de pagos y cómo conseguir los primeros 100 clientes. Incluye precios y unit economics.

---

## 17. Sistema de pagos

### 17.1 Dos sistemas de pago distintos (no confundirlos)

1. **Nuestra suscripción**: lo que la clínica nos paga a nosotros.
2. **Las señales de los pacientes**: lo que el paciente paga a la clínica a través de nosotros. Es una funcionalidad del producto y, a partir del año 2, una segunda línea de ingresos.

### 17.2 Estructura de precios

| | **Solo** | **Clínica** ⭐ | **Multi** |
|---|---|---|---|
| Precio mensual | **49 €** | **89 €** | **179 €** |
| Anual (−20 %) | 470 €/año | 854 €/año | 1.718 €/año |
| Para quién | Autónomo, 1 profesional | 2–5 profesionales | 2+ locales |
| Locales | 1 | 1 | Hasta 3 (+49 €/local extra) |
| **Usuarios** | **Ilimitados** | **Ilimitados** | **Ilimitados** |
| **Contactos** | **Ilimitados** | **Ilimitados** | **Ilimitados** |
| Conversaciones IA incluidas/mes | 300 | 1.000 | 3.000 |
| Conversación extra | 0,08 € | 0,06 € | 0,05 € |
| Agenda + disponibilidad | ✅ | ✅ | ✅ |
| Recordatorios anti no-show | ✅ | ✅ | ✅ |
| Lista de espera automática | — | ✅ | ✅ |
| Cobro de señales | — | ✅ | ✅ |
| Integración software clínico | — | ✅ | ✅ |
| Marcador de ROI | ✅ | ✅ | ✅ + comparativas |
| Soporte | Email, 24 h | WhatsApp, 4 h | Prioritario, 2 h |
| Voz (desde T3) | — | +39 € | Incluido 500 min |

**Coste de mensajes de Meta**: repercutido a **coste + 15 %**, desglosado en la factura, con estimación mensual visible en el panel. Un cliente típico paga 3–12 €/mes por este concepto. La transparencia es deliberada: es el ataque directo a la queja n.º 1 contra ManyChat y Wati.

**Todos los precios sin IVA** (21 % en España, añadido por Stripe Tax).

### 17.3 Por qué estos precios

- **89 € es el plan ancla** y donde queremos al 70 % de los clientes. Está por debajo del umbral psicológico de los 100 € (decisión sin pensar para una clínica) y muy por debajo de lo que cuesta media hora de recepcionista al día.
- **Frente al mercado**: Wati Business llega a 229 $ y cobra por asiento; respond.io Growth cuesta 159 $; los recepcionistas de IA verticales van de 150 a 500 $/mes. Estamos entre un 40 % y un 70 % por debajo del vertical de voz **y damos más funcionalidad de agenda**. No competimos por ser baratos: competimos por ser obviamente rentables.
- **Nunca por contacto ni por asiento.** Es nuestra bandera comercial y aparece en la web en grande: *"Usuarios ilimitados. Contactos ilimitados. Sin sorpresas en la factura."*
- **Nunca cobrar por "conversación de IA" de forma opaca.** El contador se ve en el panel en tiempo real y avisa al 80 %.

### 17.4 Ofertas y palancas

| Palanca | Detalle | Objetivo |
|---|---|---|
| **Prueba de 14 días** | Sin tarjeta, funcionalidad completa | Máxima entrada al embudo |
| **Precio fundador** | Primeros 20 clientes: 39 €/mes **de por vida** a cambio de testimonio grabado y una llamada de feedback al mes | Arrancar y aprender |
| **Garantía anti no-show** | *"Si en 60 días no bajamos tus ausencias, te devolvemos todo"* | Elimina el riesgo percibido. Es la frase que cierra ventas |
| **Anual con 20 % de descuento** | Cobro por adelantado | Caja y reducción de churn |
| **Referidos** | 1 mes gratis para quien recomienda y para el recomendado | Motor orgánico en un sector muy endogámico |
| **Sin permanencia** | Cancelación desde el panel, sin llamada | Contraste directo con los competidores que dificultan la baja |

### 17.5 Implementación técnica del cobro

**Nuestra suscripción — Stripe Billing:**
- Suscripciones con periodo de prueba sin método de pago, y aviso 3 días antes del fin.
- Precios escalonados: cuota base fija + componente medido para el consumo por encima del incluido.
- **Libro mayor de uso propio** (tabla `usage_events`) como fuente de la verdad; a Stripe se le reportan agregados. Nunca depender de Stripe para saber qué ha consumido un cliente: si hay una discrepancia, necesitamos poder demostrarla nosotros.
- Portal de cliente de Stripe para facturas, tarjeta y cancelación autoservicio.
- **Stripe Tax** para el IVA español y las reglas de la UE.
- **SEPA además de tarjeta**: en España muchas clínicas prefieren domiciliación.
- Recuperación de impagos: reintentos inteligentes, avisos por email y por WhatsApp, y **degradación en lugar de corte** — a los 7 días de impago la IA deja de responder pero los recordatorios de citas siguen funcionando 7 días más. Cortarle el canal a una clínica de golpe es hacerle daño a sus pacientes, y garantiza que nunca vuelva.

**Señales de pacientes — Stripe Connect:**
- Cuenta conectada por clínica (onboarding de Stripe, KYC incluido).
- El dinero va **directamente a la clínica**, no pasa por nuestra cuenta. Esto nos evita ser entidad de pago y todo el peso regulatorio asociado. Decisión importante.
- La IA genera un enlace de pago; el paciente paga; el webhook confirma la cita automáticamente.
- **Comisión: 0 % en el año 1** (es un gancho de venta). A partir del año 2, 0,5–1 % como segunda línea de ingresos, con aviso previo y opción de mantenerse en 0 % para clientes existentes.
- Política de reembolso configurable por la clínica (nosotros solo ejecutamos la suya).

### 17.6 Unit economics

**Coste mensual por cliente (plan de 89 €, uso típico de 400 conversaciones):**

| Concepto | Escenario base | Optimizado (T3) |
|---|---|---|
| Modelos de IA | 12,00 € | 6,50 € |
| Mensajes de Meta (utility, repercutidos con margen) | 0,00 € (neto positivo) | 0,00 € |
| Infraestructura (prorrateada) | 2,50 € | 1,80 € |
| Stripe (1,5 % + 0,25 €) | 1,60 € | 1,60 € |
| Soporte (prorrateado) | 2,50 € | 1,50 € |
| **COGS total** | **18,60 €** | **11,40 €** |
| **Margen bruto** | **79 %** | **87 %** |

**Modelo de valor de vida:**

| | Base | Conservador |
|---|---|---|
| ARPU | 89 € | 69 € |
| Margen bruto | 79 % | 72 % |
| Contribución mensual | 70,3 € | 49,7 € |
| Churn mensual | 3,0 % | 5,0 % |
| Vida media | 33 meses | 20 meses |
| **LTV** | **2.320 €** | **994 €** |
| CAC objetivo | 250 € | 250 € |
| **LTV / CAC** | **9,3×** | **4,0×** |
| **Payback** | **3,6 meses** | **5,0 meses** |

Incluso en el escenario conservador, las cifras funcionan. Y el margen de seguridad está en el precio: si hiciera falta, tenemos espacio para subir a 119 € en el plan ancla, porque el ROI declarado del cliente es de 10× o más.

**Sensibilidad — la variable que más importa es el churn.** A 8 % mensual, la vida media cae a 12,5 meses y el LTV a 620 €: el negocio deja de funcionar. Por eso el Marcador de ROI y la integración con el software clínico no son "funcionalidades bonitas": **son la infraestructura de retención**, y por eso ocupan un lugar tan alto en el roadmap.

---

## 20. Cómo conseguir los primeros 100 clientes

### 20.1 La verdad incómoda de partida

No hay ningún canal escalable que funcione a 0 clientes. Los anuncios sin caso de éxito queman dinero, el SEO tarda 6 meses y el contenido sin autoridad no lo lee nadie. **Los primeros 30 clientes se consiguen a mano, uno a uno, por el fundador.** Cualquier plan que diga otra cosa es un plan para gastar dinero, no para conseguir clientes.

La buena noticia es que 100 clientes son 100 clínicas. Solo en España hay ~24.000. Necesitamos el **0,4 %**.

### 20.2 Fase 1 — Clientes 1 a 10 (meses 1–3): a pie de calle

**Objetivo: 3 pilotos gratuitos → 10 de pago. Presupuesto: ~200 €.**

| Táctica | Ejecución | Esperado |
|---|---|---|
| **Puerta fría física** | Lista de 60 clínicas dentales en tu ciudad. Visita a media mañana (martes a jueves, 10:30–12:30, cuando hay menos carga). Pedir 10 minutos con el gerente | 60 visitas → 15 demos → 5 pilotos |
| **Círculo cercano** | Tu dentista, el de tu familia, amigos con clínica. La conversación más fácil que vas a tener | 5 conversaciones → 2 pilotos |
| **Grupos de Facebook y LinkedIn del sector dental español** | Aportar valor **sin vender** durante 3 semanas antes de mencionar nada | 3–5 conversaciones cualificadas |
| **Calculadora de coste de no-shows** | Página web gratuita: metes tus datos y te dice cuánto pierdes al año. Pide el email para enviar el informe | 100–200 emails el primer mes |

**El guion de la puerta fría (memorízalo):**

> *"Hola, buenos días. Soy [nombre], trabajo con clínicas dentales aquí en [ciudad]. Una pregunta rápida y me voy: ¿cuántos pacientes os fallaron la semana pasada?"*
>
> *[Deja que respondan. Siempre hay número, y siempre les molesta.]*
>
> *"Ya. Eso son unos [X] € al mes. He montado un sistema que contesta vuestro WhatsApp 24 horas, apunta las citas solo en vuestra agenda, y persigue a los que no confirman. Lo estoy instalando gratis en tres clínicas de aquí para pulirlo. Si en dos meses no os bajan las ausencias, lo quitamos y no habéis pagado nada. ¿Os interesa ser una de las tres?"*

Sin hablar de IA. Sin hablar de tecnología. Solo dinero perdido y una oferta sin riesgo.

**Las 5 objeciones que vas a oír, y la respuesta:**

| Objeción | Respuesta |
|---|---|
| *"Ya tengo recepcionista"* | "Perfecto, esto no la sustituye: le quita el trabajo repetitivo y cubre las noches y los findes, que es cuando escribe el 40 % de la gente." |
| *"Mis pacientes quieren hablar con una persona"* | "Y la van a tener: en cuanto alguien lo pide o menciona dolor, avisamos a tu equipo al instante. La IA solo hace lo aburrido." |
| *"No me fío de que conteste una máquina"* | "Por eso las dos primeras semanas funciona en modo aprobación: te propone la respuesta y tú la sueltas con un toque. Si no te convence, no se envía." |
| *"Es que soy un desastre con la tecnología"* | "Te lo dejo funcionando yo en 30 minutos. Y después se usa desde el móvil, menos que WhatsApp normal." |
| *"¿Y la protección de datos?"* | "Todo en servidores europeos, contrato de encargado de tratamiento firmado en el alta, y tu asesor puede revisarlo. Es de las pocas del mercado que lo tiene." |

**Regla de la fase 1:** con cada piloto, **te sientas dentro de la clínica una mañana entera**. Ves cómo trabajan, qué preguntan los pacientes, dónde falla la IA. Vale más que seis meses de analítica.

### 20.3 Fase 2 — Clientes 10 a 30 (meses 3–5): la prueba social

**Objetivo: convertir el éxito en munición. Presupuesto: ~500 €.**

1. **El caso de estudio con euros.** De tu mejor piloto: *"Clínica X recuperó 4.200 € en 60 días y bajó sus ausencias del 17 % al 6 %."* Con nombre, con foto, con cifras reales y permiso por escrito. **Un caso concreto vale más que toda la web.**
2. **Vídeo testimonio de 90 segundos** grabado con el móvil en su clínica. El dueño hablando, no tú.
3. **Referidos activados**: pídelo explícitamente, no esperes a que pase. *"¿Conoces a dos compañeros a los que les pasaría lo mismo?"* En dental el boca a boca es brutal: los dueños de clínica se conocen entre ellos, coinciden en cursos y en congresos.
4. **Outbound frío bien hecho**: 30 clínicas al día por email + WhatsApp, personalizado de verdad (menciona su web, su horario, algo real). Con el caso de estudio dentro. Espera 2–4 % de respuesta.
5. **Colegios de dentistas provinciales**: newsletters, ofertas para colegiados, charlas.
6. **LinkedIn del fundador**: construir en público. Publicar los números reales de la empresa cada semana. Atrae clientes, futuros socios y, más adelante, inversores.

### 20.4 Fase 3 — Clientes 30 a 60 (meses 5–8): apalancarse en otros

**Objetivo: que alguien más venda por ti. Presupuesto: ~1.500 €.**

| Canal | Por qué funciona | Modelo |
|---|---|---|
| **Distribuidores de material dental** | Sus comerciales ya entran en cada clínica de España cada mes. Es el mejor canal del sector, y casi nadie lo usa para software | 20 % recurrente el primer año |
| **Software de gestión clínica** | Integrarnos y aparecer en su marketplace. Ellos ganan retención, nosotros distribución | Reparto de ingresos o tarifa de referencia |
| **Agencias de marketing dental** | Ya gestionan la captación de la clínica; nosotros cerramos el círculo con las citas | 20 % recurrente + panel de agencia |
| **Gestorías y asesorías del sector sanitario** | Confianza total del dueño, cero coste de adquisición | Comisión por referencia |
| **Congresos y ferias** (Expodental y similares) | Concentración enorme de decisores en dos días | Coste alto, evaluar tras los 60 clientes |

**Objetivo de esta fase: 3 partners activos que generen entre los tres 10 clientes al mes.**

### 20.5 Fase 4 — Clientes 60 a 100 (meses 8–12): motores repetibles

**Objetivo: canales que funcionen sin ti. Presupuesto: 2.000–3.000 €/mes.**

1. **SEO en español, muy específico**: "reducir no shows clínica dental", "software citas whatsapp clínica", "recepcionista virtual dental". Poco volumen y altísima intención. Empezar en el mes 3 para cosechar en el 9.
2. **YouTube**: demos reales de 5 minutos. En este sector, ver el producto funcionando convierte más que cualquier página de aterrizaje.
3. **Google Ads** con presupuesto pequeño y muy acotado, solo sobre términos de intención de compra. Empezar **después** de tener el caso de estudio, nunca antes.
4. **Comparativas honestas**: "Recepta vs. Wati", "Recepta vs. ManyChat para clínicas". Tráfico de altísima intención que los competidores no cubren bien.
5. **Directorios**: Capterra, GetApp, G2, Software del Sol. Con reseñas de clientes reales pedidas una a una.
6. **Primer comercial a comisión** cuando el proceso ya esté probado y documentado, no antes.

### 20.6 Objetivos y presupuesto acumulados

| Fase | Meses | Clientes | Canal dominante | CAC | Inversión |
|---|---|---|---|---|---|
| 1 | 1–3 | 10 | Puerta fría del fundador | ~20 € + tiempo | 200 € |
| 2 | 3–5 | 30 | Prueba social + referidos | ~80 € | 500 € |
| 3 | 5–8 | 60 | Partners | ~180 € | 1.500 € |
| 4 | 8–12 | 100+ | SEO + ads + directorios | ~280 € | 8.000 € |
| | | **100–300** | | **~200 € medio** | **~10.200 €** |

**Con 100 clientes a 89 € tenemos ~8.900 € de MRR** (106 k€ de ARR) habiendo invertido ~10.000 € en marketing. Es un negocio, no una apuesta.

### 20.7 Las métricas que miramos cada semana

| Métrica | Umbral de alarma |
|---|---|
| Demos realizadas | < 10/semana en fase 1 |
| Demo → prueba | < 40 % |
| Prueba → pago | < 25 % |
| Conexión de WhatsApp completada en el alta | < 60 % ⚠️ el paso más frágil |
| Churn mensual | > 5 % 🚨 |
| Clientes que abren el panel al menos 1 vez/semana | < 70 % |
| Conversaciones resueltas sin humano | < 70 % |
| Clientes con ≥1 evento de valor en 30 días | < 90 % 🚨 |

**La última es la métrica de alerta temprana definitiva.** Un cliente sin ningún evento de valor en 30 días es un cliente que va a cancelar, aunque todavía no lo sepa. Cuando aparezca en esa lista, se le llama ese mismo día.

### 20.8 Lo que NO vamos a hacer para captar clientes

- ❌ Enviar mensajes masivos de WhatsApp en frío. Ilegal según el RGPD, contrario a las políticas de Meta, y nos jugamos la reputación como Tech Provider. Sería suicida vender un producto anti-spam haciendo spam.
- ❌ Product Hunt, comunidades de fundadores, Hacker News. Nuestro cliente no está ahí. Ni uno.
- ❌ Gastar en anuncios antes de tener un caso de estudio con euros.
- ❌ Rebajar el precio para cerrar. Se regala un mes, se amplía la garantía, se añade el onboarding hecho por nosotros — pero el precio de lista no se toca. Un cliente que entra por precio se va por precio.
- ❌ Aceptar clientes fuera del ICP en los primeros 6 meses, por muy tentador que sea el dinero. Cada restaurante que aceptemos nos desvía el roadmap.
