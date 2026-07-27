# Estrategias: qué son, qué pueden y qué no

> **Aviso previo.** Aquí no hay ninguna estrategia milagrosa, y si alguien te
> ofrece una, te está vendiendo algo. Todo lo implementado son técnicas públicas,
> documentadas desde hace décadas y usadas por millones de personas. Precisamente
> por eso: cualquier ventaja que tuvieran está muy arbitrada, es pequeña,
> inestable y puede haber desaparecido.
>
> Se implementan porque son **transparentes y auditables**: puedes leer las diez
> líneas que toman la decisión y entenderlas por completo. Eso vale más que una
> caja negra que "funciona" hasta que deja de funcionar y no sabes por qué.

Consulta la misma documentación desde el terminal:

```bash
python -m bot strategies                 # todas
python -m bot strategies ema_crossover   # una
```

---

## Las dos familias

Casi todo el trading sistemático clásico cae en una de estas dos cajas, y son
**opuestas**. Esto no es un detalle académico: determina cuándo gana cada una y
por qué combinarlas suele suavizar la curva de capital más que optimizar
cualquiera de ellas por separado.

| | Seguimiento de tendencia | Reversión a la media |
|---|---|---|
| **Apuesta** | Lo que sube seguirá subiendo | Lo que se aleja mucho vuelve |
| **Tasa de acierto** | Baja (30–45 %) | Alta (60–75 %) |
| **Perfil de pagos** | Muchas pérdidas pequeñas, pocas ganancias grandes | Muchas ganancias pequeñas, pocas pérdidas grandes |
| **Funciona en** | Mercados direccionales | Mercados laterales |
| **Sufre en** | Mercados laterales (sierra) | Tendencias fuertes y desplomes |
| **Dolor principal** | Psicológico: acertar poco y aguantar drawdowns largos | Financiero: la operación que sale mal borra veinte buenas |
| **Riesgo de ruina** | Bajo (los stops cortan pronto) | **Alto sin stop estricto** |

Una regla que conviene interiorizar: **la reversión a la media es cómoda de
operar y peligrosa; el seguimiento de tendencia es incómodo y más robusto.** La
comodidad de acertar el 70 % de las veces es exactamente lo que hace que la gente
retire el stop "solo esta vez".

---

## Seguimiento de tendencia

### `ema_crossover` — Cruce de medias exponenciales

**Cómo funciona.** Entra en largo cuando la EMA rápida cruza al alza la EMA
lenta, con el precio por encima de una EMA larga que filtra el régimen. Sale con
el cruce a la baja. Stop inicial a `2 × ATR`.

**Por qué podría funcionar.** Captura *momentum*: la persistencia de precios está
documentada en múltiples clases de activos (Jegadeesh & Titman 1993; Moskowitz,
Ooi & Pedersen 2012). La explicación conductual habitual es la infrarreacción de
los participantes a la información nueva. El filtro de tendencia larga evita
operar contra la dirección dominante, que es donde este tipo de sistema acumula
la mayoría de sus falsas señales.

**Limitaciones.**
- Retardo estructural: las medias son filtros causales. Siempre entra tarde y
  sale tarde. Nunca comprarás el mínimo ni venderás el máximo.
- En laterales genera *whipsaws*: entradas y salidas seguidas con pérdida, cada
  una pagando comisión y slippage.
- Acierta poco (30–45 %). Todo depende de que unas pocas operaciones grandes
  compensen muchas pequeñas.
- Es la estrategia más popular del mundo. Está muy arbitrada.

**Riesgos.**
- **Sobreoptimización**: probar 200 combinaciones de periodos y quedarse con la
  mejor produce un pasado precioso y un futuro decepcionante.
- Rachas de pérdidas de meses en mercados laterales. Es la causa número uno de
  que la gente apague el bot justo antes de la operación que lo habría salvado.

**Parámetros que importan.** `fast_period` / `slow_period` (más separados = menos
señales, más fiables, más tarde) y `use_trend_filter` (desactivarlo multiplica
las señales y las pérdidas en lateral).

---

### `donchian_breakout` — Ruptura de canal (estilo Turtle)

**Cómo funciona.** Compra cuando el cierre supera el máximo de los últimos `N`
periodos —calculado **sin incluir la vela actual**, para no hacer trampa— y sale
cuando pierde el mínimo de los últimos `M`, o por stop de ATR.

**Por qué podría funcionar.** Es la mecánica del sistema Turtle original (Dennis
& Eckhardt, 1983) y la base de los *managed futures* / CTA. La lógica: un precio
que supera su máximo de N periodos ha resuelto un equilibrio de oferta y demanda,
y la continuación es más probable que la reversión.

**Limitaciones.**
- Muchas rupturas son falsas (acierta 30–40 %).
- El Turtle original operaba **decenas de futuros diversificados**. Aplicado a
  uno o dos pares de cripto pierde casi toda su diversificación y se vuelve mucho
  más errático. Esta es la limitación más importante y la que más se ignora.
- Devuelve buena parte de la ganancia en cada salida, porque la señal de salida
  es por definición posterior al máximo.

**Riesgos.**
- Drawdowns prolongados: la curva pasa la mayor parte del tiempo bajo su máximo.
- En cripto las rupturas coinciden con picos de volatilidad, donde el slippage
  real supera con mucho al modelado.
- **Concentración disfrazada**: si BTC, ETH y SOL rompen a la vez, no tienes tres
  posiciones, tienes una apuesta con tres nombres. Están correlacionadas.

---

### `macd_trend` — Cruce del MACD

**Cómo funciona.** Entra cuando la línea MACD cruza al alza su señal, con el
precio sobre una media larga. Sale con el cruce bajista.

**Por qué podría funcionar.** El MACD es la diferencia de dos EMAs: mide
*aceleración* del momentum, no su nivel. Reacciona algo antes que un cruce simple
de medias, a costa de más señales falsas.

**Limitaciones.** Genera bastantes más señales que el cruce de medias, y por tanto
más comisiones. En marcos temporales cortos es fácil que las comisiones se coman
todo lo que aporta la señal.

**Riesgos.** Sobreoperación. Mira siempre la línea "Comisiones (% del PnL bruto)"
del informe de backtest: si pasa del 30 %, el sistema opera demasiado para el
margen que obtiene.

---

## Reversión a la media

> **Antes de activar cualquiera de estas: el stop no es opcional.** El perfil de
> pagos (muchas ganancias pequeñas, pocas pérdidas grandes) significa que una
> sola operación sin stop puede borrar meses de trabajo. Y jamás promedies a la
> baja: este bot no lo hace, y no debe hacerlo.

### `rsi_mean_reversion` — Sobreventa del RSI

**Cómo funciona.** Compra cuando el RSI cae bajo el nivel de sobreventa, con dos
filtros que reducen mucho el peligro: tendencia larga (no comprar sobreventa en
mercado bajista) y ADX opcional (no apostar por la reversión cuando la tendencia
es muy fuerte). Sale cuando el RSI se recupera, por stop, o por tiempo.

**Por qué podría funcionar.** Tras movimientos bruscos a la baja aparece un rebote
técnico por dos motivos documentados: la **provisión de liquidez** (quien compra
el pánico cobra una prima por asumir riesgo de inventario) y la **sobrerreacción**
de los participantes (De Bondt & Thaler, 1985). En cripto el efecto se aprecia en
marcos cortos, donde las liquidaciones forzadas amplifican los movimientos.

**Limitaciones.**
- **Sobreventa no significa suelo.** En un bajista el RSI puede estar bajo 30
  durante semanas mientras el precio sigue cayendo.
- Un backtest sin comisiones parece espectacular: opera mucho y gana poco por
  operación, así que los costes se llevan una parte enorme del resultado.
- El filtro de tendencia reduce drásticamente las oportunidades. Ese es el precio
  de no comprar en caída libre, y merece la pena pagarlo.

**Riesgos.**
- **Riesgo de ruina en eventos extremos**: un desplome del 40 % en horas convierte
  "reversión a la media" en pérdida permanente.
- En criptomonedas pequeñas, lo que parece sobreventa puede ser el principio de
  una quiebra o un fraude. El precio no vuelve nunca.

**Salida por tiempo (`max_bars_in_trade`).** Muy recomendable. Si la reversión no
ocurre pronto, la tesis de la operación ha dejado de ser válida y seguir dentro es
esperanza, no estrategia.

---

### `bollinger_reversion` — Toque de banda inferior

**Cómo funciona.** Entra cuando el precio **cierra** bajo la banda inferior de
Bollinger; sale al recuperar la media central.

**Por qué podría funcionar.** Las bandas normalizan la desviación por la
volatilidad reciente, así que la señal se adapta al régimen: en periodos tranquilos
basta un movimiento pequeño; en agitados exige uno grande. Misma lógica de
sobrerreacción que el RSI, medida en desviaciones típicas.

**Limitaciones.**
- En una tendencia bajista fuerte el precio "camina por la banda" y la estrategia
  entra una y otra vez contra la tendencia.
- Las bandas se ensanchan **después** del movimiento (la volatilidad se mide con
  retardo), así que la señal llega con el daño hecho.
- Con `num_std` bajo opera muchísimo y dominan las comisiones; con `num_std` alto
  casi no opera y la muestra es demasiado pequeña para concluir nada.

**Riesgos.** La alta tasa de acierto genera una falsa sensación de fiabilidad.
Mira el **profit factor** y el **peor trade**, nunca el porcentaje de aciertos.

---

## `buy_and_hold` — La referencia obligatoria

No es una estrategia para producción: es el **listón**. Aparece en todos los
informes de backtest y no se puede desactivar.

Si tu sistema, con 200 operaciones, comisiones, slippage, riesgo operativo y
noches sin dormir, no bate a comprar y esperar, la respuesta racional es comprar
y esperar. Ocurre mucho más a menudo de lo que la gente admite, sobre todo en
mercados alcistas, porque los sistemas activos pasan mucho tiempo fuera del
mercado.

**El matiz legítimo:** un sistema puede valer la pena aunque rente menos, si su
drawdown es mucho menor. Comprar y mantener cripto implica asumir caídas del
70–85 %, que históricamente son normales. Compara siempre **ambas** columnas:
rentabilidad y drawdown máximo.

---

## Combinar estrategias

El bot puede ejecutar varias a la vez, cada una con su propio `risk_weight` y sus
posiciones lógicas independientes. Ideas que ayudan de verdad:

1. **Combina familias opuestas** (una de tendencia + una de reversión). Sus malos
   momentos tienden a no coincidir, y eso suaviza la curva de capital más que
   afinar los parámetros de cualquiera de ellas.
2. **Reparte el presupuesto de riesgo con `risk_weight`**, no cambiando los
   parámetros internos de la estrategia. Así puedes bajar el peso de una sin
   alterar su lógica ni invalidar su backtest.
3. **Cuidado con la correlación.** Tres estrategias sobre BTC, ETH y SOL no son
   tres apuestas: en una caída general las tres pierden a la vez. Los límites de
   `max_total_exposure_pct` y `max_concurrent_positions` existen justamente para
   esto.
4. **Mide cada una por separado.** La base de datos guarda `strategy_id` en cada
   operación: si una lleva meses restando, apágala.

---

## Cómo añadir una estrategia nueva

1. Crea `bot/strategies/mi_estrategia.py`.
2. Hereda de `Strategy`, decórala con `@register("mi_estrategia")`.
3. Implementa `warmup` y `generate(window, position)`.
4. **Rellena `EDGE`, `LIMITATIONS` y `RISKS`.** Es obligatorio y hay un test que
   lo comprueba. No es burocracia: si no eres capaz de escribir por qué debería
   funcionar y cuándo va a fallar, no la operes con dinero.
5. Impórtala en `bot/strategies/__init__.py`.
6. Añádela al YAML y ejecuta `python -m bot backtest`.

```python
@register("mi_estrategia")
class MiEstrategia(Strategy):
    family = "Seguimiento de tendencia"
    summary = "Una frase clara de qué hace."
    EDGE = "Por qué podría tener ventaja, con referencias si las hay."
    LIMITATIONS = ("Qué no captura.", "Cuándo se degrada.")
    RISKS = ("Qué puede salir muy mal.",)
    DEFAULTS = {"periodo": 20}

    @property
    def warmup(self) -> int:
        return self.params["periodo"] + 10

    def generate(self, window, position):
        if not self.ready(window):
            return None
        ...
```

La estrategia **no** conoce el capital, ni el tamaño, ni las comisiones. Solo
dice *qué* hacer. De *cuánto* y de *si se permite* se encarga el `RiskManager`.

---

## Cómo leer un backtest sin engañarte

Por orden de importancia:

1. **¿Bate a comprar y mantener?** Si no, ¿al menos con mucho menos drawdown?
2. **¿Cuántas operaciones?** Menos de 30 es ruido con formato de tabla.
3. **¿Cuánto se llevan las comisiones?** Por encima del 30 % del PnL bruto, el
   sistema opera demasiado.
4. **¿Cuál es el peor trade?** Debe parecerse al riesgo planificado. Si lo
   multiplica, el stop no está funcionando.
5. **¿Cuánto dura el drawdown máximo?** No la profundidad: la **duración**. Seis
   meses bajo agua es lo que hace que la gente abandone.
6. **¿Aguanta el walk-forward?** Si la eficiencia OOS/IS está por debajo de 0,5,
   es sobreajuste. `python -m bot optimize`.
7. **¿Sobrevive a cambiar los parámetros un poco?** Si con `fast_period=21` gana y
   con `20` o `22` pierde, has encontrado ruido, no una regularidad.

Y la regla final: **espera en real un drawdown de al menos 1,5× el peor del
backtest**, y una rentabilidad bastante menor. El backtest es la mejor versión
posible de la historia; la realidad tiene slippage peor, fallos de conexión y
decisiones tuyas a las tres de la mañana.
