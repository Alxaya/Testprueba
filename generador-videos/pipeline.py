#!/usr/bin/env python3
"""
Generador de videos estilo TikTok con herramientas 100% gratuitas.

Flujo:
  1. descargar   — baja el video original desde una URL (TikTok/YouTube) con yt-dlp
  2. transcribir — saca el guion del video con Whisper local (faster-whisper)
  3. prompt      — genera el prompt para reescribir el guion (pégalo en claude.ai)
  4. voz         — convierte tu guion nuevo en voz en off + subtítulos (edge-tts)
  5. visuales    — descarga clips verticales de stock desde Pexels (clave gratuita)
  6. montar      — une clips + voz + subtítulos en un video 9:16 con ffmpeg

Uso típico:
  python pipeline.py descargar "https://www.tiktok.com/@usuario/video/123"
  python pipeline.py transcribir
  python pipeline.py prompt
  (escribe el guion nuevo en salida/guion.txt)
  python pipeline.py voz
  python pipeline.py visuales "oficina moderna, persona escribiendo, ciudad de noche"
  python pipeline.py montar
"""

import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
from pathlib import Path

SALIDA = Path(__file__).parent / "salida"
CLIPS = SALIDA / "clips"
VOZ_DEFECTO = "es-MX-JorgeNeural"  # otras: es-ES-AlvaroNeural, es-MX-DaliaNeural
ANCHO, ALTO = 1080, 1920


def ffmpeg_exe() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def duracion_audio(ruta: Path) -> float:
    """Lee la duración de un archivo de audio/video parseando la salida de ffmpeg."""
    r = subprocess.run([ffmpeg_exe(), "-i", str(ruta)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", r.stderr)
    if not m:
        sys.exit(f"No pude leer la duración de {ruta}")
    h, mnt, s = m.groups()
    return int(h) * 3600 + int(mnt) * 60 + float(s)


# ── 1. Descargar ─────────────────────────────────────────────────────────────

def cmd_descargar(args):
    SALIDA.mkdir(parents=True, exist_ok=True)
    destino = SALIDA / "original.mp4"
    subprocess.run(
        ["yt-dlp", "-f", "mp4/bestvideo*+bestaudio/best", "-o", str(destino), args.url],
        check=True,
    )
    print(f"✅ Video guardado en {destino}")


# ── 2. Transcribir ───────────────────────────────────────────────────────────

def cmd_transcribir(args):
    from faster_whisper import WhisperModel

    origen = SALIDA / "original.mp4"
    if not origen.exists():
        sys.exit("Primero ejecuta: python pipeline.py descargar <URL>")

    print("Cargando modelo Whisper (la primera vez descarga ~150 MB)...")
    modelo = WhisperModel(args.modelo, device="cpu", compute_type="int8")
    segmentos, info = modelo.transcribe(str(origen), language="es")

    texto = " ".join(s.text.strip() for s in segmentos)
    destino = SALIDA / "transcripcion.txt"
    destino.write_text(texto, encoding="utf-8")
    print(f"✅ Transcripción guardada en {destino}\n")
    print(texto)


# ── 3. Prompt para reescribir el guion ───────────────────────────────────────

PLANTILLA_PROMPT = """Eres un guionista experto en videos cortos virales (TikTok/Reels/Shorts).

A continuación te paso la transcripción de un video viral. Reescríbela como un guion
NUEVO y ORIGINAL en español: misma idea central, pero con otro gancho inicial,
otras palabras y otro cierre con llamada a la acción. No copies frases literales.

Reglas:
- Duración al leerlo en voz alta: 30-45 segundos (unas 90-130 palabras).
- Primera frase = gancho fuerte (pregunta, dato sorprendente o afirmación polémica).
- Frases cortas, lenguaje hablado, nada de listas ni encabezados.
- Devuelve SOLO el texto del guion, sin comentarios.

Transcripción original:
---
{transcripcion}
---"""


def cmd_prompt(args):
    trans = SALIDA / "transcripcion.txt"
    if not trans.exists():
        sys.exit("Primero ejecuta: python pipeline.py transcribir")
    destino = SALIDA / "prompt_guion.txt"
    destino.write_text(
        PLANTILLA_PROMPT.format(transcripcion=trans.read_text(encoding="utf-8")),
        encoding="utf-8",
    )
    print(f"✅ Prompt guardado en {destino}")
    print("Pégalo en claude.ai (gratis) y guarda la respuesta en salida/guion.txt")


# ── 4. Voz en off + subtítulos ───────────────────────────────────────────────

async def _generar_voz(texto: str, voz: str, mp3: Path, ritmo: str, tono: str):
    import edge_tts

    palabras = []  # (inicio_s, fin_s, palabra)
    com = edge_tts.Communicate(texto, voz, rate=ritmo, pitch=tono, boundary="WordBoundary")
    with open(mp3, "wb") as f:
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                ini = chunk["offset"] / 10_000_000
                fin = ini + chunk["duration"] / 10_000_000
                palabras.append((ini, fin, chunk["text"]))
    return palabras


def _ass_desde_palabras(palabras, destino: Path, por_grupo=3):
    """Subtítulos ASS grandes y centrados, en grupos de pocas palabras (estilo TikTok)."""
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {ANCHO}
PlayResY: {ALTO}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Outline, Shadow, Alignment, MarginL, MarginR, MarginV
Style: TikTok,DejaVu Sans,110,&H00FFFFFF,&H00000000,&H80000000,-1,8,2,5,60,60,0

[Events]
Format: Layer, Start, End, Style, Text
"""

    def t(seg):
        h = int(seg // 3600); m = int(seg % 3600 // 60); s = seg % 60
        return f"{h}:{m:02d}:{s:05.2f}"

    lineas = []
    for i in range(0, len(palabras), por_grupo):
        grupo = palabras[i : i + por_grupo]
        ini, fin = grupo[0][0], grupo[-1][1]
        texto = " ".join(p[2] for p in grupo).upper()
        lineas.append(f"Dialogue: 0,{t(ini)},{t(fin)},TikTok,{texto}")
    destino.write_text(cab + "\n".join(lineas) + "\n", encoding="utf-8")


def _voz_completa(bruto: Path, fin_habla: float) -> bool:
    """Comprueba que hay voz audible en todos los tramos donde hay palabras.

    edge-tts a veces devuelve el audio roto a mitad (el resto llega casi mudo
    aunque los tiempos de palabras existan); esto lo detecta para reintentar.
    """
    t = 0.0
    while t < fin_habla - 2:
        r = subprocess.run(
            [ffmpeg_exe(), "-ss", str(t), "-t", "10", "-i", str(bruto),
             "-af", "volumedetect", "-f", "null", "-"],
            capture_output=True, text=True,
        )
        m = re.search(r"max_volume: (-?[\d.]+) dB", r.stderr)
        if m and float(m.group(1)) < -40:
            print(f"⚠️  Voz casi muda en el tramo {t:.0f}-{t + 10:.0f}s")
            return False
        t += 10
    return True


def cmd_voz(args):
    guion = SALIDA / "guion.txt"
    if not guion.exists():
        sys.exit("Escribe tu guion nuevo en salida/guion.txt (ver: python pipeline.py prompt)")
    texto = guion.read_text(encoding="utf-8").strip()

    bruto = SALIDA / "voz_bruto.mp3"
    for intento in range(1, 4):
        palabras = asyncio.run(_generar_voz(texto, args.voz, bruto, args.ritmo, args.tono))
        if palabras and _voz_completa(bruto, palabras[-1][1]):
            break
        print(f"Reintentando la generación de voz ({intento}/3)...")
    else:
        sys.exit("edge-tts devolvió audio roto en 3 intentos; prueba de nuevo en unos minutos")
    if not palabras:
        sys.exit("edge-tts no devolvió tiempos de palabras; no puedo generar subtítulos")
    _ass_desde_palabras(palabras, SALIDA / "subtitulos.ass")

    # procesado para sonar menos sintético: recorte de graves/agudos extremos,
    # compresión suave y un toque muy sutil de sala
    cadena = (
        "highpass=f=75,lowpass=f=12000,"
        "acompressor=threshold=-26dB:ratio=3:attack=10:release=250:makeup=5dB,"
        "acompressor=threshold=-16dB:ratio=2:attack=10:release=250:makeup=2dB,"
        "aecho=0.7:0.22:16:0.06"
    )

    # normalización en dos pasadas (ganancia FIJA, nunca varía a mitad de video):
    # 1ª pasada mide el volumen, 2ª aplica la corrección exacta
    r = subprocess.run(
        [ffmpeg_exe(), "-i", str(bruto), "-af",
         cadena + ",loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    m = re.search(r"\{[^{}]+\}", r.stderr[r.stderr.rfind("Parsed_loudnorm"):])
    if not m:
        sys.exit(f"ffmpeg falló midiendo el volumen:\n{r.stderr[-1500:]}")
    med = json.loads(m.group(0))

    # ganancia fija calculada desde la medición; NO usar loudnorm en la pasada
    # de render: su remuestreo interno a 192 kHz mete un silbido en 12 kHz
    ganancia = max(-20.0, min(20.0, -16.0 - float(med["input_i"])))

    mp3 = SALIDA / "voz.wav"
    r = subprocess.run(
        [ffmpeg_exe(), "-y", "-i", str(bruto), "-af",
         # NUNCA remuestrear: los dos remuestreadores de esta build están rotos
         # (el normal silba a 12 kHz y soxr va apagando la voz con el tiempo);
         # todo el pipeline trabaja a los 24 kHz nativos de edge-tts
         cadena + f",volume={ganancia:.2f}dB,alimiter=limit=0.89",
         str(mp3)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        sys.exit(f"ffmpeg falló procesando la voz:\n{r.stderr[-1500:]}")
    bruto.unlink()
    print(f"✅ Voz en {mp3} ({duracion_audio(mp3):.1f}s) y subtítulos en salida/subtitulos.ass")


# ── 5. Visuales desde Pexels ─────────────────────────────────────────────────

def _buscar_pexels(consulta: str, clave: str, cantidad: int):
    import httpx

    r = httpx.get(
        "https://api.pexels.com/videos/search",
        params={"query": consulta, "orientation": "portrait", "per_page": cantidad, "size": "medium"},
        headers={"Authorization": clave},
        timeout=30,
    )
    r.raise_for_status()
    return r.json().get("videos", [])


def cmd_visuales(args):
    clave = os.environ.get("PEXELS_API_KEY")
    if not clave:
        sys.exit("Define tu clave: export PEXELS_API_KEY='tu_clave'  (gratis en pexels.com/api)")

    import httpx

    CLIPS.mkdir(parents=True, exist_ok=True)
    for viejo in CLIPS.glob("*.mp4"):
        viejo.unlink()

    consultas = [c.strip() for c in args.temas.split(",") if c.strip()]
    n = 0
    for consulta in consultas:
        videos = _buscar_pexels(consulta, clave, args.por_tema)
        if not videos:
            print(f"⚠️  Sin resultados para '{consulta}'")
            continue
        # prefiere clips de al menos 5s para que no haya que congelar fotogramas
        videos.sort(key=lambda v: v.get("duration", 0) < 5)
        for video in videos[: args.por_tema]:
            # elige el archivo vertical de mayor calidad razonable (~1080 de ancho máx.)
            archivos = [f for f in video["video_files"] if f["width"] <= 1200 and f["height"] > f["width"]]
            if not archivos:
                continue
            mejor = max(archivos, key=lambda f: f["width"])
            n += 1
            destino = CLIPS / f"clip{n:02d}.mp4"
            print(f"Descargando '{consulta}' → {destino.name}")
            with httpx.stream("GET", mejor["link"], timeout=120, follow_redirects=True) as resp:
                resp.raise_for_status()
                with open(destino, "wb") as f:
                    for parte in resp.iter_bytes():
                        f.write(parte)
    if n == 0:
        sys.exit("No se descargó ningún clip; prueba otros temas (mejor en inglés: 'city night, typing').")
    print(f"✅ {n} clips en {CLIPS}")


# ── 5b. Música de fondo ──────────────────────────────────────────────────────

def cmd_musica(args):
    """Genera una cama ambiental de suspense sintetizada (sin copyright)."""
    voz = SALIDA / "voz.wav"
    dur = duracion_audio(voz) + 2 if voz.exists() else 70
    destino = SALIDA / "musica.wav"
    # solo ruido filtrado (viento/rumor grave): sin tonos puros que suenen a pitido
    filtro = (
        f"anoisesrc=color=brown:seed=1:r=24000:d={dur:.1f},lowpass=f=450,highpass=f=45,"
        "tremolo=f=0.1:d=0.55[w1];"
        f"anoisesrc=color=brown:seed=7:r=24000:d={dur:.1f},lowpass=f=120,"
        "tremolo=f=0.13:d=0.5[w2];"
        "[w1][w2]amix=inputs=2:normalize=0,"
        f"afade=t=in:d=2,afade=t=out:st={dur - 3:.1f}:d=3,volume=0.7"
    )
    r = subprocess.run(
        [ffmpeg_exe(), "-y", "-f", "lavfi", "-i", filtro, str(destino)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        sys.exit(f"ffmpeg falló generando la música:\n{r.stderr[-1500:]}")
    print(f"✅ Música ambiental en {destino} ({dur:.0f}s)")


# ── 6. Montar el video final ─────────────────────────────────────────────────

def cmd_montar(args):
    voz = SALIDA / "voz.wav"
    subs = SALIDA / "subtitulos.ass"
    clips = sorted(CLIPS.glob("*.mp4"))
    if not voz.exists() or not subs.exists():
        sys.exit("Faltan salida/voz.wav o salida/subtitulos.ass (ejecuta: python pipeline.py voz)")
    if not clips:
        sys.exit("No hay clips en salida/clips (ejecuta: python pipeline.py visuales \"tema1, tema2\")")

    dur_total = duracion_audio(voz) + 0.5
    seg = dur_total / len(clips)

    entradas, filtros, etiquetas = [], [], []
    for i, clip in enumerate(clips):
        entradas += ["-i", str(clip)]
        # recorta al segmento; si el clip es más corto, clona el último fotograma
        # solo lo que falte (el trim final garantiza duración exacta)
        filtros.append(
            f"[{i}:v]trim=duration={seg:.3f},setpts=PTS-STARTPTS,"
            f"scale={ANCHO}:{ALTO}:force_original_aspect_ratio=increase,"
            f"crop={ANCHO}:{ALTO},fps=30,"
            f"tpad=stop_mode=clone:stop_duration={seg:.3f},"
            f"trim=duration={seg:.3f},setpts=PTS-STARTPTS[v{i}]"
        )
        etiquetas.append(f"[v{i}]")

    filtros.append(
        "".join(etiquetas) + f"concat=n={len(clips)}:v=1:a=0,"
        f"trim=duration={dur_total:.3f},"
        f"subtitles='{subs}':fontsdir=/usr/share/fonts[vf]"
    )

    # música de fondo solo si se pide explícitamente con --musica
    musica = SALIDA / "musica.wav"
    n = len(clips)
    if args.musica and musica.exists():
        entradas += ["-i", str(voz), "-stream_loop", "-1", "-i", str(musica)]
        filtros.append(
            f"[{n + 1}:a]volume=0.12[mus];"
            f"[{n}:a][mus]amix=inputs=2:duration=first:normalize=0[af]"
        )
        mapa_audio = "[af]"
    else:
        entradas += ["-i", str(voz)]
        mapa_audio = f"{n}:a"

    destino = SALIDA / "video_final.mp4"
    cmd = (
        [ffmpeg_exe(), "-y", *entradas,
         "-filter_complex", ";".join(filtros),
         "-map", "[vf]", "-map", mapa_audio,
         "-c:v", "libx264", "-preset", "fast", "-crf", "27",
         "-c:a", "aac", "-b:a", "96k", "-ar", "24000", "-shortest", str(destino)]
    )
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"ffmpeg falló:\n{r.stderr[-2000:]}")
    print(f"✅ Video final: {destino} ({duracion_audio(destino):.1f}s, {ANCHO}x{ALTO})")


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("descargar", help="Descargar video original desde una URL")
    d.add_argument("url")
    d.set_defaults(fn=cmd_descargar)

    t = sub.add_parser("transcribir", help="Transcribir el video con Whisper local")
    t.add_argument("--modelo", default="small", help="tiny/base/small/medium (defecto: small)")
    t.set_defaults(fn=cmd_transcribir)

    pr = sub.add_parser("prompt", help="Generar el prompt para reescribir el guion")
    pr.set_defaults(fn=cmd_prompt)

    v = sub.add_parser("voz", help="Generar voz en off y subtítulos desde salida/guion.txt")
    v.add_argument("--voz", default=VOZ_DEFECTO)
    v.add_argument("--ritmo", default="+8%", help="Velocidad, ej: -10%% (lento) o +15%% (rápido)")
    v.add_argument("--tono", default="+0Hz", help="Tono, ej: -20Hz (más grave) o +10Hz (más agudo)")
    v.set_defaults(fn=cmd_voz)

    mu = sub.add_parser("musica", help="Generar música ambiental de suspense (sin copyright)")
    mu.set_defaults(fn=cmd_musica)

    vi = sub.add_parser("visuales", help="Descargar clips de stock desde Pexels")
    vi.add_argument("temas", help='Temas separados por coma, ej: "city night, typing on laptop"')
    vi.add_argument("--por-tema", type=int, default=2, help="Clips por tema (defecto: 2)")
    vi.set_defaults(fn=cmd_visuales)

    m = sub.add_parser("montar", help="Montar el video final 9:16")
    m.add_argument("--musica", action="store_true",
                   help="Mezclar salida/musica.wav de fondo (por defecto: solo voz)")
    m.set_defaults(fn=cmd_montar)

    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
