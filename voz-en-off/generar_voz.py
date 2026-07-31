#!/usr/bin/env python3
"""
Genera la voz en off del guion narrativo a partir de guion.txt.

Cada bloque del guion se sintetiza por separado con edge-tts (voces neuronales
de Microsoft, gratis) y luego se une con silencios reales entre bloques. Así se
controla la pausa exacta entre frase y frase, que es lo que da el ritmo lento y
confidencial: los silencios forman parte del texto.

Uso:
    python generar_voz.py                    # genera voz_en_off.mp3
    python generar_voz.py --rate=-18%        # más lento
    python generar_voz.py --pausas 1.15      # alarga todos los silencios un 15%
    python generar_voz.py --solo-medir       # estima duración sin sintetizar

Requisitos:
    pip install edge-tts imageio-ffmpeg
"""

import argparse
import asyncio
import re
import subprocess
import sys
from pathlib import Path

BASE = Path(__file__).parent
GUION = BASE / "guion.txt"
SALIDA = BASE / "salida"
TROZOS = SALIDA / "trozos"

VOZ = "es-ES-AlvaroNeural"   # masculina, castellano; grave al bajarle el tono
RATE = "-10%"               # ritmo pausado sin que la prosodia suene estirada
PITCH = "-30Hz"             # timbre más grave y cálido
VOLUME = "-8%"              # un punto por debajo: voz contenida, no proyectada

PAUSA_DEFECTO = 1.2         # segundos entre bloques sin marca [[n]]
ENTRADA = 0.6               # silencio antes de la primera frase
SALIDA_COLA = 1.9           # silencio al final, para que el vídeo respire

SR = 24000                  # edge-tts entrega 24 kHz mono


def ffmpeg() -> str:
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def duracion(ruta: Path) -> float:
    r = subprocess.run([ffmpeg(), "-i", str(ruta)], capture_output=True, text=True)
    m = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", r.stderr)
    if not m:
        sys.exit(f"No pude leer la duración de {ruta}")
    h, mnt, s = m.groups()
    return int(h) * 3600 + int(mnt) * 60 + float(s)


def mmss(segundos: float) -> str:
    return f"{int(segundos // 60)}:{segundos % 60:04.1f}"


def leer_guion(ruta: Path, pausa_defecto: float):
    """Devuelve [(texto, pausa_despues)] a partir del guion anotado."""
    bloques, actual = [], []

    def cerrar():
        if actual:
            bloques.append([" ".join(actual), pausa_defecto])
            actual.clear()

    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#"):
            cerrar()
            continue
        marca = re.fullmatch(r"\[\[([0-9.]+)\]\]", linea)
        if marca:
            cerrar()
            if bloques:
                bloques[-1][1] = float(marca.group(1))
            continue
        actual.append(linea)
    cerrar()
    return [(t, p) for t, p in bloques]


async def sintetizar(texto: str, destino: Path, voz: str, rate: str,
                     pitch: str, volume: str, intentos: int = 4):
    import edge_tts
    for intento in range(1, intentos + 1):
        try:
            com = edge_tts.Communicate(texto, voz, rate=rate, pitch=pitch,
                                       volume=volume)
            await com.save(str(destino))
            if destino.stat().st_size > 0:
                return
            raise RuntimeError("archivo vacío")
        except Exception as e:  # red intermitente: reintento con espera creciente
            if intento == intentos:
                raise
            espera = 2 ** intento
            print(f"   reintento {intento} en {espera}s ({e})")
            await asyncio.sleep(espera)


def a_wav(origen: Path, destino: Path):
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-i", str(origen),
                    "-ar", str(SR), "-ac", "1", str(destino)], check=True)


def silencio(segundos: float, destino: Path):
    subprocess.run([ffmpeg(), "-y", "-loglevel", "error", "-f", "lavfi",
                    "-i", f"anullsrc=r={SR}:cl=mono", "-t", f"{segundos:.3f}",
                    str(destino)], check=True)


def main():
    p = argparse.ArgumentParser(description=__doc__,
                               formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--voz", default=VOZ)
    p.add_argument("--rate", default=RATE, help="velocidad, ej. -16%%")
    p.add_argument("--pitch", default=PITCH, help="tono, ej. -30Hz")
    p.add_argument("--volume", default=VOLUME)
    p.add_argument("--pausas", type=float, default=1.0,
                   help="multiplica todos los silencios (1.1 = 10%% más largos)")
    p.add_argument("--pausa-defecto", type=float, default=PAUSA_DEFECTO)
    p.add_argument("--sin-eq", action="store_true",
                   help="no aplicar el ecualizado cálido ni normalizar")
    p.add_argument("--solo-medir", action="store_true",
                   help="mide los trozos ya generados sin volver a sintetizar")
    p.add_argument("--salida", default=str(BASE / "voz_en_off.mp3"))
    args = p.parse_args()

    bloques = leer_guion(GUION, args.pausa_defecto)
    if not bloques:
        sys.exit("El guion está vacío.")
    TROZOS.mkdir(parents=True, exist_ok=True)

    palabras = sum(len(t.split()) for t, _ in bloques)
    pausa_total = sum(p for _, p in bloques[:-1]) * args.pausas
    print(f"{len(bloques)} bloques · {palabras} palabras · "
          f"{pausa_total:.0f}s de silencios entre bloques")

    partes = []
    entrada = TROZOS / "000_entrada.wav"
    silencio(ENTRADA, entrada)
    partes.append(entrada)

    for i, (texto, pausa) in enumerate(bloques, start=1):
        mp3 = TROZOS / f"{i:03d}.mp3"
        wav = TROZOS / f"{i:03d}.wav"
        if not args.solo_medir or not wav.exists():
            print(f"[{i:>2}/{len(bloques)}] {texto[:62]}...")
            asyncio.run(sintetizar(texto, mp3, args.voz, args.rate,
                                   args.pitch, args.volume))
            a_wav(mp3, wav)
        partes.append(wav)

        segundos = (pausa if i < len(bloques) else SALIDA_COLA) * args.pausas
        sil = TROZOS / f"{i:03d}_pausa.wav"
        silencio(segundos, sil)
        partes.append(sil)

    lista = SALIDA / "partes.txt"
    lista.write_text("".join(f"file '{p.resolve()}'\n" for p in partes),
                     encoding="utf-8")

    destino = Path(args.salida)
    destino.parent.mkdir(parents=True, exist_ok=True)
    cmd = [ffmpeg(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
           "-i", str(lista)]
    if not args.sin_eq:
        # Calidez: refuerzo suave de graves, un pelo menos de dureza en medios
        # altos, y loudness a -16 LUFS (referencia habitual de YouTube en voz).
        cmd += ["-af", "equalizer=f=140:width_type=q:w=0.8:g=2.5,"
                       "equalizer=f=3200:width_type=q:w=1.2:g=-1.5,"
                       "loudnorm=I=-16:TP=-1.5:LRA=11"]
    cmd += ["-c:a", "libmp3lame", "-b:a", "192k", "-ar", "44100", "-ac", "1",
            str(destino)]
    subprocess.run(cmd, check=True)

    total = duracion(destino)
    voz_neta = total - pausa_total - (ENTRADA + SALIDA_COLA) * args.pausas
    print(f"\n✅ {destino}")
    print(f"   duración total: {mmss(total)}  ({total:.1f}s)")
    print(f"   velocidad real: {palabras / voz_neta * 60:.0f} palabras/minuto")


if __name__ == "__main__":
    main()
