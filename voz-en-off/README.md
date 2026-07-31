# Voz en off — "La última tarde"

Locución en español para un vídeo narrativo de YouTube. El máster listo para
montar es **`voz_en_off.mp3`** (8:54, mono, 44.1 kHz, 192 kbps, −16 LUFS).

## Cómo está hecha

`generar_voz.py` sintetiza el guion con [edge-tts](https://github.com/rany2/edge-tts)
(voces neuronales de Microsoft, gratis y sin clave de API) y monta el resultado
con ffmpeg.

La clave del tono no está en la voz sino en el montaje: **cada bloque del guion
se sintetiza por separado y los silencios se insertan como audio real entre
bloque y bloque**. Así la pausa es exacta y no depende de cómo interprete el
motor los puntos y aparte. Los silencios son parte del texto, no un hueco.

## Ajustes de interpretación

| Parámetro | Valor | Por qué |
|---|---|---|
| Voz | `es-ES-AlvaroNeural` | Masculina, adulta, castellano (el guion usa "os despedisteis", "coche", "colegio") |
| Tono | `-30 Hz` | Baja la fundamental a ~97 Hz de mediana: grave y cercano, sin sonar artificial |
| Velocidad | `-10 %` | 130 palabras/minuto reales, muy por debajo de una narración normal (~150-160) |
| Volumen | `-8 %` | Voz contenida, de alguien que habla bajo, no proyectada |
| Pausas | 1,0 – 2,0 s | 1,2 s por defecto; 1,4 s tras un remate; 1,65-1,95 s en los cambios de bloque |
| Ecualización | +2,5 dB @140 Hz, −1,5 dB @3,2 kHz | Calidez en el cuerpo de la voz y menos dureza en los medios altos |
| Loudness | −16 LUFS, pico −1,5 dBTP | Referencia habitual de YouTube para voz |

Se eligió una bajada de velocidad moderada en el motor y silencios largos entre
frases en lugar de estirar mucho la locución: por encima de −15 % la prosodia
empieza a sonar arrastrada, y el ritmo pausado se consigue mejor con el
silencio que con la lentitud.

## Regenerar

```bash
pip install edge-tts imageio-ffmpeg
python generar_voz.py
```

Los trozos intermedios quedan en `salida/` (ignorada por git). Opciones útiles:

```bash
python generar_voz.py --rate=-16%        # aún más lento
python generar_voz.py --pausas 1.15      # todos los silencios un 15 % más largos
python generar_voz.py --voz es-MX-JorgeNeural   # variante latinoamericana
python generar_voz.py --sin-eq           # sin ecualizar ni normalizar
python generar_voz.py --solo-medir       # remonta cambiando solo las pausas
```

`--solo-medir` reutiliza los audios ya sintetizados: sirve para retocar
silencios y volver a montar en segundos, sin llamar otra vez al servicio.

## Editar el ritmo

En `guion.txt`, una línea `[[n]]` entre dos bloques fija el silencio en segundos
que va después del bloque anterior. Las líneas que empiezan por `#` son
comentarios. El texto locutado es literalmente el del guion original, sin
cambiar ni una palabra.

## Si hace falta otra voz

edge-tts no permite controlar el estilo interpretativo más allá de tono,
velocidad y volumen. Si se quiere una interpretación más matizada (susurro,
intención frase a frase), habría que pasar a un motor de pago —ElevenLabs o
Azure Speech con SSML de estilos— reutilizando el mismo `guion.txt`: el formato
de bloques y pausas es independiente del motor.
