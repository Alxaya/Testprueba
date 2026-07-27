# Guía de operación y seguridad

Cómo poner esto en producción sin llevarte un disgusto.

---

## 1. Seguridad de las claves de API

Esto es lo más importante del documento. Un bot comprometido con una clave mal
configurada no pierde una operación: pierde la cuenta.

### Al crear la clave en el exchange

| Ajuste | Valor | Por qué |
|---|---|---|
| Permiso de **lectura** | ✅ Activado | Necesario para leer saldos y órdenes |
| Permiso de **spot trading** | ✅ Activado | Necesario para operar |
| Permiso de **retirada** | ❌ **DESACTIVADO** | El bot no lo necesita **jamás**. Con esto activado, cualquier filtración de la clave es una pérdida total |
| Permiso de **futuros/margen** | ❌ Desactivado | Salvo que hayas decidido conscientemente operar derivados |
| **Restricción por IP** | ✅ La IP del servidor | Una clave robada no sirve desde otra IP |

El bot comprueba al arrancar (en los exchanges que lo exponen) si la clave tiene
permiso de retirada y avisa por log y por Telegram si lo tiene.

### En el servidor

```bash
chmod 600 .env                # solo el propietario puede leerlo
```

- `.env` y `config/config.yaml` están en `.gitignore`. **Nunca** los subas.
- Los logs enmascaran claves, firmas y tokens automáticamente
  (`SecretMaskingFilter`), pero no confíes tu seguridad solo a eso.
- No ejecutes el bot como `root`. Crea un usuario dedicado.
- Si sospechas que una clave se ha filtrado: revócala **primero**, investiga
  después.

---

## 2. Ruta hacia dinero real

No te saltes pasos. Cada uno existe porque alguien perdió dinero por saltárselo.

```
1. backtest              →  ¿bate a comprar y mantener? ¿30+ operaciones?
2. walk-forward          →  ¿la eficiencia OOS/IS supera 0,5?
3. paper (2+ semanas)    →  ¿aguanta 24/7 sin caerse? ¿coincide con el backtest?
4. testnet del exchange  →  ¿las órdenes reales se ejecutan como esperabas?
5. live con capital mínimo → lo que puedas perder sin que te afecte
6. escalado gradual      →  solo tras semanas de coherencia
```

### Antes de activar el modo `live`

```bash
python -m bot doctor          # debe salir sin errores
```

Y a mano en el YAML:

```yaml
mode: live
i_understand_live_trading_risk: true    # incómodo a propósito
```

El CLI además pide escribir literalmente `SI ACEPTO EL RIESGO` por teclado. Puedes
saltarlo con `--yes` para automatización, pero piénsalo dos veces.

### Qué medir durante las primeras semanas en real

- **Slippage real vs. modelado.** Compara el precio de referencia de la señal con
  el precio de ejecución. Si el real es sistemáticamente peor que los 5 bps
  configurados, sube `execution.slippage_bps` y **rehaz el backtest**: tus
  resultados esperados eran optimistas.
- **Discrepancias de reconciliación.** Cualquier aviso de "órdenes abiertas al
  arrancar" merece investigación.
- **Frecuencia real de operaciones** frente a la del backtest. Si difieren mucho,
  algo no cuadra en los datos o en el calendario de velas.

---

## 3. Kill switch: cómo parar todo

Tres formas, de más rápida a más ordenada:

```bash
# 1. Fichero centinela (instantáneo, no necesita tocar el proceso).
#    Deja de abrir posiciones y cierra las abiertas en el siguiente ciclo.
touch data/KILL

# 2. Desde el panel web: botón "Activar kill switch".

# 3. Apagado ordenado del proceso (NO cierra posiciones).
kill -TERM <pid>
```

**Diferencia crucial:** el kill switch **cierra posiciones**; apagar el proceso
**no**. Es deliberado: cerrar una posición es una decisión de trading y no debe
tomarla una señal del sistema operativo, un reinicio del servidor o un despliegue.

Para reanudar tras un kill switch por fichero:

```bash
rm data/KILL          # y reinicia el bot
```

El kill switch automático (drawdown máximo) **no se desactiva solo**: exige
intervención manual. Si tu sistema perdió el 15 %, lo que toca es entender por
qué, no volver a encenderlo.

---

## 4. Despliegue 24/7

### systemd (recomendado en un VPS)

```bash
sudo cp deploy/trading-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now trading-bot
sudo journalctl -u trading-bot -f
```

El servicio se reinicia solo si el proceso muere (`Restart=always`), con
`RestartSec=30` para no entrar en bucle rápido de reinicios.

### Docker

```bash
docker compose up -d
docker compose logs -f
```

Los volúmenes `data/` y `logs/` se montan fuera del contenedor: puedes recrear la
imagen sin perder el histórico ni la base de datos.

### Requisitos del servidor

- **Reloj sincronizado (NTP).** Casi todos los exchanges rechazan peticiones
  firmadas con desfase horario. Es la causa número uno de errores raros de
  autenticación.
- **Zona horaria UTC.** Todo el bot trabaja en UTC; tener el servidor en otra zona
  solo genera confusión al leer logs.
- 1 vCPU y 1 GB de RAM sobran para unos pocos símbolos.
- Conexión estable. El bot aguanta cortes (reintentos con backoff), pero un corte
  durante una ejecución significa incertidumbre sobre el estado.

---

## 5. Monitorización

### Qué vigilar a diario

- **Heartbeat de Telegram.** Si deja de llegar, el bot está muerto o sin red.
- **Drawdown actual** en el panel.
- **Errores** (`status.errors` en `/api/status`). Si crece, algo se está
  reiniciando en bucle.
- **Señales rechazadas** (`/api/signals`). Muchos rechazos por
  `insufficient_cash` o `max_exposure` significan que tu configuración de riesgo
  no encaja con el capital.

### Sonda de salud

```bash
curl -f http://127.0.0.1:8000/health || echo "BOT CAÍDO"
```

No requiere token: está pensada para supervisores y contenedores.

---

## 6. Exponer el panel fuera de localhost

Por defecto escucha solo en `127.0.0.1`. Para acceder desde fuera, en orden de
preferencia:

1. **Túnel SSH** (lo más seguro, y no expone nada):
   ```bash
   ssh -L 8000:127.0.0.1:8000 usuario@servidor
   ```
2. **Proxy inverso con TLS** (nginx/Caddy) + token:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(32))"  # → WEB_AUTH_TOKEN
   ```
   La configuración **rechaza arrancar** si escuchas fuera de localhost sin token.

Nunca abras el puerto directamente a internet sin TLS: el token viajaría en claro.

### Túneles (Cloudflare Tunnel, ngrok, SSH inverso)

Un túnel es la forma más cómoda de llegar al panel desde el móvil sin abrir
puertos ni tener IP fija:

```bash
cloudflared tunnel --url http://localhost:8000
# devuelve una URL https://algo-aleatorio.trycloudflare.com
```

**Aquí hay una trampa que conviene entender.** El bot sigue escuchando en
`127.0.0.1`, así que la validación de configuración que exige token al bindear
fuera de localhost **no salta** — pero el túnel acaba de publicar tu panel en
internet. La comprobación no puede detectarlo: desde dentro del proceso, un
túnel es indistinguible de nada.

Por eso el panel falla en cerrado: **sin token, los endpoints de escritura
devuelven 403**, incluso en localhost. Si no fuese así, cualquiera con la URL
podría accionar tu kill switch y cerrar tus posiciones.

Antes de levantar un túnel, siempre:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# ponlo en .env como WEB_AUTH_TOKEN y reinicia el bot
```

Y accede con el token en la URL: `https://…trycloudflare.com/?token=TU_TOKEN`
(el panel lo guarda en `localStorage`, así que solo hace falta la primera vez).

Ten presente además que:

- Las URLs de `trycloudflare.com` son aleatorias pero **no son secretas**: viajan
  por el historial del navegador, por donde las compartas y por los registros de
  cualquier intermediario. El token es lo que protege, no lo impredecible de la
  URL.
- Con una cuenta de Cloudflare puedes poner **Cloudflare Access** delante del
  túnel y exigir login por correo. Es gratis para uso personal y bastante mejor
  que depender solo del token.
- Un túnel rápido muere al cerrar el proceso `cloudflared`. Para algo permanente
  hace falta un túnel con nombre y un dominio en Cloudflare.

El bot avisa en el log al arrancar siempre que el panel funcione sin token, sea
cual sea el host, precisamente por este escenario.

---

## 7. Copias de seguridad

Lo único irremplazable es la base de datos:

```bash
sqlite3 data/bot.db ".backup 'backup-$(date +%F).db'"
```

`data/ohlcv.db` es solo caché: se puede volver a descargar. Los logs rotan solos
(10 MB × 5 ficheros por defecto).

---

## 8. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `NetworkError` que esconde `CERTIFICATE_VERIFY_FAILED` | Proxy corporativo o VPN con inspección TLS | El bot ya lee `REQUESTS_CA_BUNDLE`/`SSL_CERT_FILE`; asegúrate de que apuntan a la CA correcta |
| `HTTP 451` del exchange | Geobloqueo del país o del centro de datos | Usa otro exchange (`exchange.id`) o un servidor en otra región |
| `Timestamp for this request is outside of the recvWindow` | Reloj desincronizado | Instala y activa NTP |
| "Datos rancios, no se opera" | El feed va con retraso | Es *fail-closed* intencionado. Revisa la conexión y el estado del exchange |
| Órdenes rechazadas por `min_notional` | Capital insuficiente para el tamaño mínimo del par | Sube el capital, baja el número de posiciones simultáneas o elige pares con mínimos menores |
| El bot no abre nada | Filtros de riesgo o de tendencia | Mira `/api/signals`: el motivo del rechazo está registrado |
| Muchas señales `cooldown` | Racha de pérdidas | Está funcionando como debe. Revisa la estrategia antes de subir los límites |

---

## 9. Recordatorio final

Este software **no es asesoramiento financiero**. Opera con criptomonedas, que
son volátiles y no están respaldadas. **Puedes perder todo el capital.** El código
está probado, pero ningún test elimina el riesgo de mercado, ni el de que una
estrategia deje de funcionar precisamente cuando la pones en producción.

No inviertas dinero que necesites.
