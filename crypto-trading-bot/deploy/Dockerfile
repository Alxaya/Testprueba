# Imagen del bot. Multi-stage para que la final no arrastre compiladores.
FROM python:3.11-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


FROM python:3.11-slim

# El bot no necesita root. Si algo se compromete, que sea con los mínimos permisos.
RUN useradd --create-home --shell /bin/bash bot

# tzdata: el bot trabaja en UTC y necesita la base de zonas horarias.
# ca-certificates: verificación TLS contra los exchanges.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

ENV TZ=UTC \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

COPY --from=builder /install /usr/local
WORKDIR /app
COPY --chown=bot:bot bot/ ./bot/
COPY --chown=bot:bot config/config.example.yaml ./config/

RUN mkdir -p /app/data /app/logs && chown -R bot:bot /app
USER bot

# Sonda de salud: usa el endpoint /health, que no requiere token.
HEALTHCHECK --interval=60s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

EXPOSE 8000

# Por defecto, paper trading. Cambiar a "live" es una decisión consciente.
CMD ["python", "-m", "bot", "-c", "config/config.yaml", "paper"]
