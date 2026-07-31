# Parte 3 — Prompts de imagen por bloque visual

**Estado: BLOQUEADO.** Se ha comprobado con una llamada real de producción (no una prueba) y el bloqueo se confirma a nivel de cuenta:
- Magnific (MCP): `images_generate` y también `stock_search` devuelven **"Magnific MCP requires a premium account. Upgrade your plan at https://www.magnific.com/pricing to use it."** — todo el servicio de imágenes de Magnific (generación e incluso el buscador de stock Freepik integrado) requiere plan premium, no solo la generación.
- Artlist (MCP): `get_balance` confirma **0 generaciones de imagen gratis restantes** y **sin créditos contratados** ("creditsIncluded: false"). Solo queda 1 generación de vídeo gratis, que no sirve para imágenes.
- No hay ninguna otra herramienta de generación de imágenes gratuita disponible en este entorno además de estas dos.

Estos 89 prompts están listos para pegar tal cual en `images_generate` (Magnific) o `generate_image` (Artlist) en cuanto haya cuenta premium / créditos disponibles. Cada prompt final = ESTILO + escena específica del bloque.

## ESTILO OBLIGATORIO (prefijo fijo para las 89 imágenes)

```
Simple 2D stick figure cartoon, hand-drawn doodle style, thick black outlines, clean white or light solid background, flat colors, amateur MS Paint aesthetic, Zenn YouTube channel style. Stickmen with round heads, stick bodies, dot or circle eyes with expressions of surprise, confusion or panic. Simple objects: bonfires, domes, magnifying glasses, fossils, brains, question marks, arrows, screens, signs. Flat colors only to highlight key elements: yellow, red, blue, orange, green, gray. No realistic shading, no 3D, no complex lighting, no anime, no professional vector art, no realistic humans. Looks intentionally amateur and simple, like a child's MS Paint drawing. Horizontal 16:9 format.
```

## Escena específica por bloque (añadir al prefijo de estilo)

[01] A stick figure looking down at a stain on its shirt, wide panicked eyes, sweat-drop lines, a giant spotlight cone shining down on it from above.
[02] Other stick figures nearby all looking at their own phones, none looking at the panicked stick figure; a crossed-out eye icon.
[03] A brain icon inside the stick figure's head with a "mentira" label and a crooked zigzag line.
[04] A giant spotlight beam following a walking stick figure like a stage light, with a trail of footprints.
[05] Close-up of a stick figure's face with small icons around it: an error X, a stumble icon, a scribble speech bubble.
[06] A stick figure imagining a large exaggerated crowd of stick figures all pointing and staring at it.
[07] A spotlight beam switching off, leaving only a dotted outline where it used to be.
[08] A smartphone with a photo and comment bubbles, next to a cave wall drawing, connected by a dotted arrow.
[09] An arrow pointing from a modern phone icon back to a simple prehistoric stick figure sitting by a fire.
[10] A stick figure at a podium with a microphone, spotlight cone above, knees shaking with motion lines.
[11] A stick figure retyping a phone message many times ("100x" label), next to a crossed-out stumble icon nobody notices.
[12] A university sign reading "Cornell 2000" with scientist stick figures holding clipboards outside.
[13] A stick figure holding up an embarrassing t-shirt with a comically old-fashioned singer's face on it.
[14] Close-up of the t-shirt with a cartoon singer face and musical notes, labeled "Barry Manilow".
[15] The t-shirt-wearing stick figure walking down a long hallway of stick figures who aren't looking at it.
[16] A scientist stick figure with a clipboard asking a question, a thought bubble showing a percentage.
[17] A big "50%" graphic next to a small crowd icon.
[18] The scientist now asking the hallway stick figures a question, thought bubbles with question marks above their heads.
[19] A "less than 25%" graphic, several stick figures shrugging, one looking down at the ground for the first time.
[20] The t-shirt stick figure standing rigid and sweating, with three exaggerated eye icons watching it.
[21] The same stick figure small in the corner, a tiny stopwatch icon showing "1 second" of attention.
[22] A crossed-out laboratory beaker icon, replaced by a party balloon icon, a briefcase icon, and a heart icon in a row.
[23] Three small scene icons in one frame (party balloon, briefcase, two hearts), all linked by the same spotlight cone.
[24] Two stick figures facing each other, one with a large imagined spotlight above it, the other looking uninterested.
[25] A glowing spotlight cone icon labeled "Efecto Spotlight" with a ticking clock hand beside it.
[26] A stick figure mid-sentence with a stumble/scribble speech bubble, no t-shirt in sight this time.
[27] A stick figure at a meeting table tripping over a word, other stick figures barely glancing up.
[28] A calendar showing two days passing, a fading blurry memory cloud around the stumble icon.
[29] A simple brain icon with a question mark and a slightly uncomfortable wavy line around it.
[30] A clock face showing 24 hours, a stick figure sitting inside its own head-shaped thought bubble the whole time.
[31] A stick figure's eyes with radiating outward lines, a small mirror reflecting back at itself.
[32] A stick figure standing in a spotlight surrounded by other stick figures, all facing inward toward it.
[33] The same spotlight cone now appearing above every stick figure in the group, not just one.
[34] Several stick figures each with their own tiny stain, tiny stumble icon, and tiny mistake bubble.
[35] A stick figure trying to watch everyone else, but its eye-arrows are drawn curving back toward itself.
[36] A glass/crystal outline drawn around a stick figure's body, labeled "ilusión de transparencia".
[37] The glass figure with tiny thought bubbles visible through it, drawn larger than they really are.
[38] A confident stick figure (arms crossed, smiling) with a small hidden thought bubble showing it also worrying.
[39] Three stick figures of different sizes representing different ages, all with the same spotlight cone above them.
[40] A teenager-shaped stick figure at a school door, spotlight cone above, nervous face.
[41] An adult stick figure presenting at a whiteboard, same spotlight cone above, nervous face.
[42] A large theater stage icon with a stick figure on it, the stage drawn oversized (exaggerated scale).
[43] A smiling stick figure with a dotted X-ray-style outline revealing a nervous stick figure hidden inside.
[44] Two stick figures side by side, both secretly sweating under their own individual spotlight, mirrored poses.
[45] A timeline arrow stretching from a modern city icon back to a simple cave/fire icon at the far end.
[46] A small group of stick figures huddled together near a fire, simple cave background.
[47] A balance-scale icon weighing a small "opinión" bubble against a heavy "supervivencia" weight.
[48] A stick figure being excluded from a hunting-party group of stick figures holding spears.
[49] The excluded stick figure alone outside the group circle, no food bowl, no fire, a small danger triangle nearby.
[50] A brain icon evolving through several generations of stick figures drawn in a row (family line).
[51] A lightning bolt striking a brain instantly, faster than a small speech-bubble/language icon appearing beside it.
[52] A stick figure safely inside a tribal circle around a fire, protected and content.
[53] A modern stick figure on a city street with a faded transparent lion silhouette walking away in the background.
[54] The same modern stick figure's chest showing a glowing alarm/siren icon still active.
[55] An office building icon faintly overlapping with a savanna grass-field icon behind it.
[56] Three icons in a row (a meeting table, a heart, a tagged photo), each with a small danger triangle.
[57] A tribal fire circle icon overlapping with the same three modern icons, showing they trigger the same alarm.
[58] A stick figure clutching its chest with a small red "ouch" burst icon, like a physical punch impact.
[59] A shield icon labeled "protección" cracking slightly, an alarm bell ringing above it.
[60] A stick figure alone in an empty room, phone in hand, spotlight cone still above it, re-reading a message.
[61] A price-tag icon hanging from the spotlight cone above a stick figure in a modern setting.
[62] A stick figure in a classroom, hand half-raised then pulled back down, worried face.
[63] A stick figure holding a phone with a photo, thumb hovering over a crossed-out "publicar" button.
[64] A stick figure lying in bed with a thought bubble replaying a looping conversation (circular arrow), several moon icons above.
[65] A speech bubble with a blank silence line "...", the other figure in the memory looking neutral and unaffected.
[66] A simple bar-chart icon labeled "ansiedad social" with a magnifying glass over it.
[67] A group of observer stick figures with clipboards rating a nervous speaker stick figure at a podium.
[68] A low-number scorecard ("nerviosismo bajo") held by observers, contrasted with a high-number thought bubble from the speaker.
[69] Split image: the speaker calm and composed from outside, a scribbled chaotic thought bubble inside.
[70] A lightbulb turning on above a stick figure's head, labeled "dato liberador".
[71] A relaxed, distracted crowd of stick figures in an audience, most looking at their own phones or yawning.
[72] A shrinking spotlight cone icon, getting smaller each time a checkmark/repeat arrow cycles past it.
[73] A stick figure pointing at a sign reading "Efecto Spotlight" with a confident checkmark.
[74] A stick figure saying the effect's name out loud in a speech bubble while the spotlight cone visibly shrinks.
[75] A simple therapy-chair icon with a calm stick figure sitting on it, a small brain-with-checkmark icon above.
[76] A magnifying glass over a brain icon with an exclamation mark, surrounded by curious scientist stick figures.
[77] A stick figure walking past a small crowd, each with a tiny "20%" fragment-memory bubble instead of a full picture.
[78] A calendar page marked "un día cualquiera" with small footprints crossing paths of several stick figures.
[79] A checklist icon with hairstyle, comment, and stumble icons all crossed out as "not remembered".
[80] A group of stick figures each absorbed inside their own individual spotlight cone/movie screen, ignoring each other.
[81] A big empty theater stage icon with rows of empty chairs, one small spotlight lit in the center.
[82] A stick figure looking into a mirror, the only eye icon in the whole scene is its own reflection's eye.
[83] A spotlight cone visibly fading above a stick figure standing alone on an empty stage.
[84] A thought bubble with a crossed-out question "¿qué piensan de mí?" above a stick figure's head.
[85] A stick figure handing an oversized "poder" token to a crowd that isn't even looking at it.
[86] A stick figure replaying a faded, dusty embarrassing memory bubble while the other person in it looks blank.
[87] A comment-bubble icon with three dots and a downward arrow inviting the viewer.
[88] A thumbs-up icon and a bell/subscribe icon side by side, bold and large, a small stick figure pointing at them.
[89] A stick figure looking at itself in a mirror with a lightbulb and sparkle icons, walking away from a shrinking spotlight.

## Cómo generar (cuando haya acceso)
Para cada [NN]: llamar a `images_generate` (Magnific) con `mode` = un modelo de `images_models_list`, o a `generate_image` (Artlist) con un `modelId` de `list_models`, usando:
`prompt = ESTILO OBLIGATORIO + ". " + escena [NN]`, aspecto 16:9.
Guardar el resultado descargado como `NN.png` (dos dígitos, con cero a la izquierda) en `curiosidades-canal/video-02-efecto-spotlight/images/`.
