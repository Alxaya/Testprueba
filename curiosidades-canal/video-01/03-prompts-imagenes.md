# Parte 3 — Prompts de imagen por bloque visual

**Estado: BLOQUEADO.** No se pudo generar ninguna imagen porque:
- Magnific (MCP) devolvió: "Magnific MCP requires a premium account."
- Artlist (MCP) devolvió: "You've used all your free generations" (0 generaciones de imagen gratis restantes, sin créditos contratados).

Estos 81 prompts están listos para pegar tal cual en `images_generate` (Magnific) o `generate_image` (Artlist) en cuanto haya cuenta premium / créditos. Cada prompt final = ESTILO + escena específica del bloque.

## ESTILO OBLIGATORIO (prefijo fijo para las 81 imágenes)

```
Simple 2D stick figure cartoon, hand-drawn doodle style, thick black outlines, white background, flat colors (red, green, blue, yellow, orange, gray only where helpful), amateur MS Paint aesthetic. Stick figures with round heads, stick bodies, dot or circle eyes, very basic facial expressions. Simple shapes only: squares, rectangles, circles, arrows, houses, screens, signs, question marks. No realistic shading, no 3D, no lighting effects, no anime, no professional vector art, no realistic humans. Looks intentionally amateur and simple, like a child's MS Paint drawing. Horizontal 16:9 format.
```

## Escena específica por bloque (añadir al prefijo de estilo)

[01] Stick figure lying in bed, eyes wide open, alarm clock on nightstand about to ring, a crossed-out "zzz" cloud above its head.
[02] Close-up of a stick figure's wide dot eyes in a dark bedroom, a small thought bubble with a clock icon inside.
[03] Big red question mark next to a simple alarm clock, stick figure sitting up in bed looking puzzled.
[04] A row of three small beds with the same stick figure yawning each morning, a wall calendar with days crossed out.
[05] A wall clock on one side, a stick figure looking at it, an arrow from the clock to the figure labeled "afuera".
[06] Stick figure with a simple gear icon drawn inside its chest, like an internal clock mechanism.
[07] Stick figure looking at a stomach with zigzag "hambre" lines, and a droopy low-energy face under an afternoon sun icon.
[08] Stick figure jumping out of bed exactly as the alarm clock's hands align, a small checkmark above its head.
[09] An airplane icon crossed with a broken clock; a moon icon with a stick figure at a desk looking sick.
[10] Stick figure shrugging with a lightbulb and question mark above its head, looking at its reflection in a simple mirror.
[11] A simple brain outline inside a stick figure's round head, with a small glowing dot behind the eyes.
[12] A tiny grain-of-rice shape next to the glowing brain dot, with a speech bubble labeled "núcleo".
[13] A gear-shaped clock icon sitting on top of a stick figure's head like a crown.
[14] A sun icon with an arrow pointing to the clock-gear on the stick figure's head, and the same figure calm in a dark room.
[15] Scientist stick figures in lab coats leading another stick figure into a simple box-shaped underground bunker door.
[16] A windowless bunker room, a crossed-out clock on the wall, a stick figure sleeping on a small bed inside.
[17] Two scientist stick figures with clipboards looking worried, a big question mark turning into a checkmark above them.
[18] A row of identical stick figures waking up in separate beds, the same simple clock time drawn above each one.
[19] A small clock with hands slightly different each day, next to a crossed-out sun icon.
[20] A stick figure alone in a plain windowless room, a glowing gear icon inside its chest, no clocks around.
[21] A big lightbulb above a stick figure's head with a "zzz" label, scientist stick figures behind giving a thumbs up.
[22] A stick figure standing firm while wind-arrow lines blow around it without moving it.
[23] A stick figure's torso with a gear, a heart, and a small clock stacked inside, labeled "cronómetro".
[24] A clock face bending and warping with a swirly arrow, a stick figure looking surprised beside it.
[25] One clock splitting into two separate clock faces, each with an arrow pointing in opposite directions.
[26] A simple sign reading "Lübeck 1999", scientist stick figures around a table with a volunteer stick figure.
[27] A sleeping stick figure with a speech-bubble clock showing "6:00" above two scientist figures.
[28] A sleeping stick figure with a speech-bubble clock showing "9:00" above two scientist figures.
[29] A scientist stick figure crossing its fingers behind its back while talking to two seated stick figures.
[30] A big surprised stick figure face with round "O" eyes, open mouth, and an exclamation mark.
[31] A sleeping stick figure with a rising arrow labeled "cortisol" beside a clock showing one hour before six.
[32] A simple hourglass icon with a checkmark next to a crossed-out, dimmed wall clock.
[33] A brain icon with a glowing clock inside it, next to a plain wall clock crossed out and dimmed.
[34] A small bottle icon labeled "cortisol" pouring into a stick figure with small lightning-bolt energy lines around it.
[35] A sleeping stick figure with a small exam-paper-and-pencil icon floating above its head like a dream bubble.
[36] An empty exam paper icon with a big question mark, a ticking clock icon beside it.
[37] A bell/alarm icon connected by a dotted line to a thought bubble instead of to sound-wave lines.
[38] A stick figure setting an alarm clock with a small star icon labeled "importante", then waking before it rings.
[39] A stick figure smiling knowingly in bed, a small star icon glowing above the alarm clock on the nightstand.
[40] A hand secretly turning back a wall clock's hands while a sleeping stick figure still shows a rising cortisol arrow.
[41] Split scene: a hand adjusting a clock secretly on one side, a rising arrow inside a sleeping figure's chest on the other.
[42] A sleeping stick figure with small gear icons turning inside its head, showing the brain is still "on".
[43] A wavy line graph rising and falling like sleep cycles, labeled "90 min", above a sleeping stick figure.
[44] A magnifying glass held over the wavy sleep graph, with a small lightbulb icon nearby.
[45] A wall calendar with a repeated wake time circled, and a sleep-wave graph dipping lighter right before that time.
[46] A stick figure doing simple jumping-jacks next to a musical note icon, with a circular repeat arrow.
[47] A stick figure with half-open eyes in bed, the alarm clock's hands a few seconds from ringing.
[48] A crossed-out magic wand with sparkles, replaced by a simple dumbbell icon above a stick figure's head.
[49] A group of stick figures with graduation caps at desks, one raising a hand with a question mark above it.
[50] A sleeping stick figure with small zigzag "wave" lines above its head, a clock showing an earlier time.
[51] A silent alarm clock with no sound lines, next to a stick figure already stretching awake in bed.
[52] A wall calendar with only two days circled, an arrow pointing to a checkmark.
[53] Two small moon icons in a row above a sleeping stick figure, the same clock time under both.
[54] A stick figure's eyes opening exactly as a clock's hands align on a bullseye/target drawn on the clock face.
[55] A cheap plastic alarm clock icon crossed out and drooping, next to a glowing brain icon standing tall.
[56] A simple cave drawing with a stick figure sleeping inside, a sunrise icon outside, no clock anywhere in the scene.
[57] A group of stick figures sleeping together in a cave, a shadowy triangular predator shape lurking nearby.
[58] A sunrise icon (half-circle with rays) with a stick figure standing alert outside the cave, thumbs up.
[59] One stick figure sleeping late near a danger-triangle icon; another stick figure standing too early looking exhausted.
[60] A stick figure standing exactly at sunrise with a trophy icon, two other figures crossed out (too early / too late).
[61] A stick figure standing in a modern bedroom with a faint transparent overlay of a caveman version sleeping in a cave behind it.
[62] A stick figure's heart icon inside its chest beating fast with small motion lines, next to an alarm clock.
[63] Three icons in a row (exam paper, handshake, airplane), each above a stick figure with a small racing heart.
[64] Split scene: a caveman stick figure alert at a cave entrance and a modern stick figure alert in bed, same heart icon on both.
[65] A triangular "danger predator" icon on one side of a stick figure's head, a question mark on the other side.
[66] A simple office desk with a briefcase icon and a clock showing seven, a stressed stick figure sitting there.
[67] A stick figure with the same racing heart icon mirrored between a predator triangle on one side and an office desk on the other.
[68] A lightbulb with a star-burst glow labeled "dato", surrounded by scientist stick figures.
[69] A windowless bunker room again, a wall calendar with several weeks crossed off.
[70] A small clock showing a barely-there eleven-minute drift arrow, next to a peacefully sleeping stick figure.
[71] A calendar month fully crossed off, a small label "5 horas" next to a slightly tilted clock face.
[72] A stick figure holding its own wrist like checking a pulse, next to a crossed-out cheap plastic watch.
[73] A stick figure looking up thoughtfully with a faint clock face drawn like a halo above its head.
[74] A stick figure closing its eyes calmly with a checkmark and a small thought bubble.
[75] A stick figure waking up right as the alarm clock's hands sit one tick before ringing, eyes wide open.
[76] A big checkmark over a gear-and-brain icon, a crossed-out dice icon beside it (no "casualidad").
[77] A stick figure looking at its own reflection in a simple mirror, a big question mark floating between both.
[78] A stick figure sitting up in bed with a speech bubble and a question mark, looking straight at the viewer.
[79] A simple comment-bubble icon with three dots, a downward arrow pointing to it labeled "comentarios".
[80] A thumbs-up icon and a bell/subscribe icon side by side, a stick figure pointing at them smiling.
[81] A stick figure looking at its own body with small curiosity sparkles around it, a question mark fading into a lightbulb.

## Cómo generar (cuando haya acceso)
Para cada [NN]: llamar a `images_generate` (Magnific) o `generate_image` (Artlist) con:
`prompt = ESTILO OBLIGATORIO + ". " + escena [NN]`, `aspectRatio/settings = 16:9`.
Guardar el resultado descargado como `NN.png` (dos dígitos, con cero a la izquierda) en `curiosidades-canal/video-01/images/`.
