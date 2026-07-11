# Generador de videos estilo TikTok (100% gratis)

Replica el sistema de "regenerar videos virales con IA" usando solo herramientas
gratuitas: sin n8n de pago, sin APIs de video caras.

| Paso | Herramienta | Costo |
|------|-------------|-------|
| Descargar video original | yt-dlp | Gratis |
| Transcribir | faster-whisper (local) | Gratis |
| Reescribir guion | Claude (claude.ai o Claude Code) | Gratis |
| Voz en off + subtítulos | edge-tts (voces de Microsoft) | Gratis |
| Clips de fondo | API de Pexels | Gratis (con clave) |
| Montaje final 9:16 | ffmpeg | Gratis |

## Instalación

```bash
pip install yt-dlp edge-tts faster-whisper imageio-ffmpeg httpx
```

No hace falta instalar ffmpeg aparte: se usa el binario que trae `imageio-ffmpeg`.

## Uso paso a paso

```bash
# 1. Descargar el video viral que quieres regenerar
python pipeline.py descargar "https://www.tiktok.com/@usuario/video/123"

# 2. Transcribirlo (la primera vez descarga el modelo Whisper)
python pipeline.py transcribir

# 3. Generar el prompt de reescritura
python pipeline.py prompt
#    → pega salida/prompt_guion.txt en claude.ai (gratis)
#    → guarda el guion nuevo en salida/guion.txt

# 4. Generar la voz en off y los subtítulos sincronizados
python pipeline.py voz
#    otras voces: --voz es-MX-JorgeNeural, --voz es-ES-ElviraNeural
#    lista completa: edge-tts --list-voices | grep es-

# 5. Descargar clips de fondo desde Pexels (clave gratis en pexels.com/api)
export PEXELS_API_KEY="tu_clave"
python pipeline.py visuales "city night aerial, typing on laptop, money counting"
#    consejo: los temas funcionan mejor en inglés

# 6. Montar el video final (1080x1920, listo para TikTok/Reels/Shorts)
python pipeline.py montar
#    → salida/video_final.mp4
```

## Notas

- **Sin clave de Pexels** también funciona: genera tus propios clips de fondo o
  pon cualquier .mp4 en `salida/clips/`.
- **Derechos de autor**: reescribe siempre la idea con guion propio; no publiques
  copias casi literales de videos de otros creadores.
- Si `transcribir` va lento, usa `--modelo tiny` (menos preciso) o `base`.
