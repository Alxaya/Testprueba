import urllib.parse
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

output_dir = '/home/user/Testprueba/imagenes'
os.makedirs(output_dir, exist_ok=True)

S = "simple hand-drawn stick figure cartoon, white background, thick black outlines, flat colors, amateur MS Paint doodle style, 16:9 horizontal, minimal detail, no shading, wobbly lines, "

images = [
    ("001_0-00", S + "bank building center, rich stickman with top hat left receives big money bag with green checkmark, poor stickman right gets red X rejected, simple arrows pointing"),
    ("002_0-05", S + "large bank building with dollar sign above entrance, stickman walking toward it from far away, money symbols floating around building"),
    ("003_0-10", S + "rich stickman with top hat and crown smiling wide, tiny tax paper with tiny number next to him, many dollar bags stacked around him, happy expression"),
    ("004_0-15", S + "giant wrench labeled DEUDA in bold block letters, stickman raising it above head triumphantly, power lightning bolts around it"),
    ("005_0-20", S + "blueprint paper on table showing bank system diagram, arrows pointing to rich stickman getting more money, design labeled EL SISTEMA"),
    ("006_0-25", S + "rich stickman with speech bubble PEDIR PRESTADO instead of PAGAR IMPUESTOS, tax collector stickman standing confused with empty hands"),
    ("007_0-30", S + "stickman looking at giant machine with gears labeled SISTEMA, question marks above head, machine only gives coins to rich stickman on other side"),
    ("008_0-35", S + "stickman sitting at kitchen table with empty wallet, thought bubble showing dollar sign with question mark, worried expression"),
    ("009_0-40", S + "stickman walking on path toward bank building in distance, determined face, small house behind him, simple road ahead"),
    ("010_0-45", S + "bank teller stickman behind glass counter pointing to three stacked documents labeled NOMINA, HISTORIAL, GARANTIAS, stern face"),
    ("011_0-50", S + "bank door with giant red X and NO APROBADO sign, sad stickman walking away with empty hands, rejection stamp effect"),
    ("012_0-55", S + "stickman labeled ELON with wild spiky hair, confident wide smile, surrounded by small company logos, standing tall"),
    ("013_1-00", S + "Twitter bird logo large in center, giant text 44000 MILLONES written in hand lettering below, money bags stacked beside it"),
    ("014_1-05", S + "Elon stickman walking into bank, bank manager stickman bowing and presenting oversized money bag, big green checkmark above"),
    ("015_1-10", S + "calendar with pages flipping fast, SEMANAS label, checkmark appearing quickly, approval stamp landing, speed lines"),
    ("016_1-15", S + "bank building with two giant eyes and magnifying glass examining small stickman standing outside, inspector vibes"),
    ("017_1-20", S + "two columns on paper: left RESPUESTA OFICIAL with handshake icon, right RESPUESTA REAL with bank grabbing stickman assets, arrow pointing to real answer"),
    ("018_1-25", S + "bank teller stickman asking QUE TIENES QUE PERDER question bubble, regular stickman looking nervous and sweating"),
    ("019_1-30", S + "house with COLATERAL label, car with COLATERAL label, stock papers with COLATERAL label, three objects shown clearly"),
    ("020_1-35", S + "office worker stickman holding tiny paycheck labeled NOMINA, paycheck visually very small compared to background bank building"),
    ("021_1-40", S + "tiny paycheck connecting with thin arrow to tiny money bag, POCO label, salaried stickman looking disappointed"),
    ("022_1-45", S + "rich stickman surrounded by tall building, car, stack of stock certificates, all with ACTIVOS label floating above each one"),
    ("023_1-50", S + "large pile of assets on scale left side going down heavy, large money bag on right side coming out of bank, arrow connecting them"),
    ("024_1-55", S + "stickman holding house in one raised hand AND cash bag in other raised hand, big smile, SIGUE SIENDO DUENO label below"),
    ("025_2-00", S + "stickman with arms raised holding property deed on left, bank giving cash on right, MANTIENE TODO text floating above"),
    ("026_2-05", S + "glowing question mark floating, exclamation point next to it, stickman pointing at mysterious door labeled QUE PASA DESPUES"),
    ("027_2-10", S + "curtain being pulled back revealing secret mechanism, stickman peeking with wide eyes, spotlight on hidden truth"),
    ("028_2-15", S + "stock chart with line going up steeply, upward arrow, stock certificate paper, green color accent, value growing"),
    ("029_2-20", S + "stickman selling stock certificate, large 26 PORCIENTO chunk flying toward tax collector stickman in uniform, sad seller face"),
    ("030_2-25", S + "tax collector stickman holding big bag labeled 26 PORCIENTO, regular stickman left holding only small bag labeled 74 PORCIENTO, unhappy"),
    ("031_2-30", S + "stickman handing stock paper to bank labeled as GARANTIA, dotted arrow showing pledge relationship, not selling"),
    ("032_2-35", S + "bank receiving stock as guarantee, handing back cash bag, big 0 IMPUESTOS symbol with circle around it, happy stickman"),
    ("033_2-40", S + "giant 0 PORCIENTO with checkmark, stickman celebrating, TECNICAMENTE NO HAS GANADO NADA text in small hand lettering"),
    ("034_2-45", S + "panel 1 of 3 labeled COMPRAR, stickman buying house and stock with dollar arrow going in, simple box frame"),
    ("035_2-50", S + "panel 2 of 3 labeled PEDIR PRESTADO, stickman getting money from bank using house as collateral, arrows showing flow"),
    ("036_2-55", S + "panel 3 of 3 labeled MORIR, simple gravestone RIP, two heir stickmen receiving property deed and money bag with upward arrow"),
    ("037_3-00", S + "three panels side by side BUY BORROW DIE sequence showing complete strategy, small labels under each panel, connected by arrows"),
    ("038_3-05", S + "stickman with spiky hair labeled ELON standing on big money pile, arms crossed confidently, Twitter bird nearby"),
    ("039_3-10", S + "stickman labeled LARRY standing next to Elon stickman, both smiling on money piles, sunglasses"),
    ("040_3-15", S + "stickman labeled JEFF with round glasses standing with other two billionaire stickmen, three figures in a row on money"),
    ("041_3-20", S + "sign reading NO ES ILEGAL with checkmark, three billionaire stickmen pointing to it, green LEGAL stamp"),
    ("042_3-25", S + "fork in road, left path going downhill labeled DEUDA MALA with red color, right path going uphill labeled DEUDA BUENA with green color"),
    ("043_3-30", S + "stickman buying old car, car with downward arrow showing depreciation, money flying out labeled PIERDE VALOR"),
    ("044_3-35", S + "car shrinking in value with downward arrow, INTERESES bills flying away from stickman wallet each month"),
    ("045_3-40", S + "stickman on beach vacation and stickman with phone, both have downward arrows and money pouring out labeled GASTO"),
    ("046_3-45", S + "stickman drowning in sea made of bills labeled INTERESES, arms flailing, struggling expression, debt waves"),
    ("047_3-50", S + "stickman getting loan with small arrow labeled 6 PORCIENTO going in, money entering investment box with growth symbol"),
    ("048_3-55", S + "investment box with upward arrow labeled 15 PORCIENTO coming out, bigger money bag emerging, growth chart"),
    ("049_4-00", S + "simple math diagram: 6 PORCIENTO in with arrow, 15 PORCIENTO out with arrow, green circle highlighting 9 PORCIENTO GANANCIA"),
    ("050_4-05", S + "coins with tiny legs running and working hard, DINERO TRABAJANDO label, happy stickman watching from chair relaxing"),
    ("051_4-10", S + "rich stickman relaxing in hammock while debt arrow labeled DEUDA does heavy lifting work, money multiplying itself"),
    ("052_4-15", S + "old stickman with glasses and bow tie labeled WARREN, wise smile, wrinkles, finger raised knowingly"),
    ("053_4-20", S + "insurance company building with customers lined up paying premiums at counter, SEGUROS label on building sign"),
    ("054_4-25", S + "arrows showing flow: customers give PRIMAS to company building, money accumulating inside"),
    ("055_4-30", S + "arrow from insurance company box going into stock market chart with bars growing, investment flow diagram"),
    ("056_4-35", S + "stock market bars growing taller, money bag doubling then tripling with x2 x3 labels, returns multiplying"),
    ("057_4-40", S + "ESE DINERO NO ERA SUYO label with big red arrow pointing to float money, stickman using it anyway with smirk"),
    ("058_4-45", S + "fortune building with foundation labeled DINERO DE OTROS, floors stacking up representing wealth built on borrowed money"),
    ("059_4-50", S + "yellow warning sign with TRAMPA label, magnifying glass, suspicious eyes peering around corner, hidden trap below"),
    ("060_4-55", S + "spotlight shining on one data point on chart, magnifying glass hovering over bar chart, UN DATO LO EXPLICA TODO text"),
    ("061_5-00", S + "row of rich stickmen with top hats, bank official giving them tiny interest label 2 A 4 PORCIENTO, all smiling"),
    ("062_5-05", S + "row of poor stickmen, giant 400 PORCIENTO number crushing them from above, staggering under weight"),
    ("063_5-10", S + "side by side comparison: rich stickman with tiny 3 PORCIENTO label, poor stickman crushed by giant 400 PORCIENTO number"),
    ("064_5-15", S + "scale balance: rich stickman side floats up easily labeled BARATO, poor stickman side crashes down labeled CARO"),
    ("065_5-20", S + "one small coin on left, mountain of 100 coins on right, label 100 VECES MAS CARO, arrow showing comparison"),
    ("066_5-25", S + "blueprint design table with THIS WAS PLANNED label, architect stickman designing unfair system intentionally, ruler and compass"),
    ("067_5-30", S + "chain of connected boxes: NO GARANTIA leads to MAS RIESGO leads to MAS INTERES leads to TRAMPA, arrows connecting all"),
    ("068_5-35", S + "domino effect: NO COLATERAL domino pushes RIESGO ALTO domino pushes INTERES ALTO domino, falling in sequence"),
    ("069_5-40", S + "stickman under 25 PORCIENTO label as heavy weight on shoulders, used car beside him, calendar showing months of work"),
    ("070_5-45", S + "calendar with many weeks checked off, stickman working each one labeled SOLO PARA PAGAR INTERESES, exhausted face"),
    ("071_5-50", S + "stickman with small 3 PORCIENTO feather-light label, property with green upward arrow, growing richer label"),
    ("072_5-55", S + "house with value arrow going up each year, coins piling up beside stickman automatically, calendar showing years passing"),
    ("073_6-00", S + "large scale dramatically tilted, rich stickman side way up high with SISTEMA label, poor stickman side way down low"),
    ("074_6-05", S + "NO NEUTRAL stamp on broken balance scale, system tilted label, stickman looking at unfairness"),
    ("075_6-10", S + "two stickmen: left one with money getting larger crown each step, right one starting from zero getting nothing, arrows showing contrast"),
    ("076_6-15", S + "ProPublica newspaper front page with magnifying glass highlighting it, INVESTIGACION 2021 label, document style"),
    ("077_6-20", S + "25 stick figures standing in row with top hats, all labeled LOS 25 MAS RICOS, numbered 1 through 25"),
    ("078_6-25", S + "giant number 401000 MILLONES in large text center, five year calendar, stacks of money in background, 5 ANOS label"),
    ("079_6-30", S + "small number 13600 next to tiny percentage 3.4 PORCIENTO, huge gap shown between wealth and taxes paid, arrow contrast"),
    ("080_6-35", S + "average worker stickman with tie under large 22 PORCIENTO label, comparison next to tiny rich person 3.4 PORCIENTO label"),
    ("081_6-40", S + "simple bar chart: very short bar RICOS 3.4 PORCIENTO, very tall bar TRABAJADOR 22 PORCIENTO, clear visual gap"),
    ("082_6-45", S + "arrow labeled 6 VECES MAS spanning gap between poor worker and rich person tax bars, unfair difference highlighted"),
    ("083_6-50", S + "LEGAL stamp green, NO ILEGAL text, but tilted scale beside it showing legal does not mean fair"),
    ("084_6-55", S + "toolbox locked with wealth key, regular stickman cannot reach key on high shelf, rich stickman easily takes it"),
    ("085_7-00", S + "velvet rope separating financial tools on left, regular stickman outside looking in, rich stickman inside using all tools"),
    ("086_7-05", S + "wrench and hammer labeled DEUDA NI BUENA NI MALA, neutral tool in center, no good or bad signs, just a tool"),
    ("087_7-10", S + "same hammer tool shown twice: rich stickman using it to build money tower, poor stickman using it as bandage patch"),
    ("088_7-15", S + "rich stickman holding debt tool multiplying money x10, speech bubble NO ME FALTA DINERO, YO LO MULTIPLICO"),
    ("089_7-20", S + "regular stickman watching rich stickman borrow and multiply, understanding lightbulb appearing above head, AHA moment"),
    ("090_7-25", S + "stickman with new understanding, see-through view of system mechanism that was previously hidden, gears now visible"),
    ("091_7-30", S + "Y TU question in large letters, fork sign with two arrows: HERRAMIENTA going up, PARCHE going down, stickman choosing"),
    ("092_7-35", S + "comment section rectangle with cursor blinking, stickman typing response, speech bubble with question mark"),
    ("093_7-40", S + "giant thumbs up LIKE button in center, excited stickman on both sides pointing at it with both hands, DALE LIKE text"),
    ("094_7-45", S + "subscribe bell notification button large in center, stickman finger pressing it, SUSCRIBETE text, ding effect lines"),
    ("095_7-50", S + "channel notification bell ringing with sound waves, stickman jumping for joy with checkmark above head, subscribe confirmed"),
    ("096_7-55", S + "stickman waving both arms goodbye, NOS VEMOS EN EL SIGUIENTE text in hand lettering below, smile, simple ending"),
]

PROXY = os.environ.get("HTTPS_PROXY", "")
CA = "/root/.ccr/ca-bundle.crt"

def download_image(idx_name, prompt):
    encoded = urllib.parse.quote(prompt)
    seed = abs(hash(idx_name)) % 9999
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=1280&height=720&nologo=true&seed={seed}"
    output = f"{output_dir}/{idx_name}.jpg"
    try:
        result = subprocess.run(
            ["curl", "--proxy", PROXY, "--cacert", CA, "-s", "-f", "-o", output, url],
            timeout=120, capture_output=True
        )
        if result.returncode == 0:
            print(f"OK: {idx_name}")
            return idx_name, True
        else:
            print(f"FAIL: {idx_name} - curl code {result.returncode}")
            return idx_name, False
    except Exception as e:
        print(f"FAIL: {idx_name} - {e}")
        return idx_name, False

print(f"Generando {len(images)} imagenes...")
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = {executor.submit(download_image, name, prompt): name for name, prompt in images}
    done = 0
    for future in as_completed(futures):
        name, success = future.result()
        done += 1
        print(f"Progreso: {done}/{len(images)}")

print("Completado.")
