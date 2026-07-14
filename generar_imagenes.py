import urllib.parse
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

output_dir = '/home/user/Testprueba/imagenes'
os.makedirs(output_dir, exist_ok=True)

PROXY = os.environ.get("HTTPS_PROXY", "")
CA = "/root/.ccr/ca-bundle.crt"

# Style: clean stick figure, simple line hands, text only when essential
S = ("simple stick figure doodle, white background, thick black outlines, "
     "flat colors, amateur MS Paint style, 16:9 horizontal, "
     "circle head with dot eyes and curved mouth, stick arms with tiny simple hands, "
     "stick legs, minimal detail, no shading, no realistic anatomy, "
     "hands as simple small lines or circles only never realistic, ")

images = [
    # --- HOOK: el banco discrimina ---
    ("001_0-00", S + "bank building center with BANCO written above door, rich stick figure with top hat on left getting money bag green checkmark above, poor stick figure on right rejected with red X above"),
    ("002_0-05", S + "large rectangular bank building center, dollar sign above door, small stick figure approaching from right side, simple road"),
    ("003_0-10", S + "rich stick figure with top hat smiling, crown above head, three money bags stacked beside him, simple white background"),
    ("004_0-15", S + "giant wrench shape center, stick figure raising arms beside it, lightning bolt shapes around wrench, power symbol"),
    ("005_0-20", S + "large paper with grid lines on it, stick figure on right side of paper with top hat getting arrow pointing to him, another stick figure on left getting nothing"),
    ("006_0-25", S + "stick figure with top hat, thought bubble above showing money bag, tax paper with tiny dot number crossed out, happy face"),
    ("007_0-30", S + "large gear machine shape center, rich stick figure on right side receiving coins, poor stick figure on left receiving nothing, question mark above machine"),
    # --- CONTEXTO: ir al banco y ser rechazado ---
    ("008_0-35", S + "stick figure sitting at table, empty wallet shape open on table, question mark floating above head, worried expression curved line mouth"),
    ("009_0-40", S + "stick figure walking on simple path toward bank building in far distance, simple ground line, determined straight mouth"),
    ("010_0-45", S + "bank teller stick figure behind tall counter pointing at three documents labeled NOMINA HISTORIAL GARANTIAS stacked on counter, visitor stick figure on other side"),
    ("011_0-50", S + "bank building with large red X on door and NO sign, stick figure walking away sad with drooping arms, dejected expression"),
    ("012_0-55", S + "tall confident stick figure center, wild spiky lines on head, arms raised slightly outward, big smile, simple white background"),
    ("013_1-00", S + "large bird shape outline center, giant oval money bag shape below it, many small circle coins scattered around, simple background"),
    ("014_1-05", S + "stick figure with spiky hair walking into building door, bank teller stick figure inside bowing forward, large money bag on counter between them"),
    ("015_1-10", S + "three calendar squares in a row showing days passing, checkmark in last square, speed lines beside calendars, simple sequence"),
    # --- COMO FUNCIONA EL BANCO ---
    ("016_1-15", S + "bank building with two large oval eyes drawn on it, magnifying circle shape in front of building, small stick figure standing below being examined"),
    ("017_1-20", S + "vertical line dividing paper into two halves, handshake shapes on left half, bank building grabbing object shape on right half, question mark over right side"),
    ("018_1-25", S + "bank teller stick figure behind counter leaning forward with large oval question mark floating between teller and visitor stick figure, visitor sweating drops"),
    ("019_1-30", S + "house shape labeled COLATERAL on left, car shape labeled COLATERAL center, stack of papers labeled COLATERAL on right, three objects with arrows"),
    ("020_1-35", S + "office worker stick figure with tie, small rectangular paycheck shape held in one arm, bank building far right looking large in comparison, sad expression"),
    ("021_1-40", S + "thin arrow from tiny paycheck rectangle to tiny money bag, small stick figure beside it looking disappointed, everything small scale"),
    ("022_1-45", S + "rich stick figure center with top hat, large house shape on left, tall building shape on right, stack of paper rectangles below, all surrounding stick figure"),
    ("023_1-50", S + "left side scale pan heavy with house shape and building shapes going down, right side bank gives out large money bag going up, balance beam tilted, simple scale"),
    ("024_1-55", S + "stick figure center with arms raised, house shape floating above left arm, money bag shape floating above right arm, big smile, both things at once"),
    ("025_2-00", S + "stick figure holding rectangular deed paper in one arm and round money bag in other arm, arrows pointing to both objects, happy expression"),
    ("026_2-05", S + "large glowing oval question mark center, exclamation mark beside it, stick figure pointing at question mark with simple line arm"),
    ("027_2-10", S + "large curtain shape on left being pulled aside, spotlight circle on right revealing hidden gears, stick figure peeking around curtain edge"),
    # --- ESTRATEGIA FISCAL: BUY BORROW DIE ---
    ("028_2-15", S + "upward diagonal arrow, stock certificate rectangle at bottom left, money bag at top right of arrow, green color on arrow, growth visual"),
    ("029_2-20", S + "stick figure selling paper to right, large chunk shape splitting off going toward tax collector stick figure in uniform hat, seller stick figure sad mouth"),
    ("030_2-25", S + "tax collector stick figure holding large round bag on left, regular stick figure holding small round bag on right, size difference visible, unhappy expression"),
    ("031_2-30", S + "stock paper rectangle with dotted arrow going to bank building, not straight sale, curved dotted line showing pledge not selling"),
    ("032_2-35", S + "bank building handing money bag to stick figure, stock paper beside bank, large zero circle with line through it above transaction, happy stick figure"),
    ("033_2-40", S + "large zero numeral center with checkmark beside it, stick figure arms raised celebrating below, simple white background"),
    ("034_2-45", S + "square frame box on left labeled 1, stick figure inside pointing at house shape and stock paper, simple panel style"),
    ("035_2-50", S + "square frame box center labeled 2, stick figure receiving money bag from bank building, house shape connected to bank with dotted arrow"),
    ("036_2-55", S + "square frame box on right labeled 3, tombstone shape with cross, two smaller stick figures beside it receiving money bags and house shape from above arrow"),
    ("037_3-00", S + "three boxes in a row with arrows between them, first box labeled COMPRAR with house, second box labeled PEDIR PRESTADO with money bag, third box labeled MORIR with tombstone and heirs"),
    # --- MUSK ELLISON BEZOS ---
    ("038_3-05", S + "tall stick figure with spiky hair standing on stack of money bags, arms crossed, confident straight posture, bird shape outline floating nearby"),
    ("039_3-10", S + "stick figure with sunglasses standing on money bag stack, arms at sides proudly, simple sunglasses two oval shapes on face"),
    ("040_3-15", S + "stick figure with round glasses on face standing beside two other stick figures, all three on money bag stacks, row of three figures"),
    ("041_3-20", S + "large rectangular sign shape center, three stick figures pointing at it from both sides, green checkmark on sign, simple approval visual"),
    # --- DOS TIPOS DE DEUDA ---
    ("042_3-25", S + "Y fork in road, left downhill path labeled DEUDA MALA with red arrow, right uphill path labeled DEUDA BUENA with green arrow, stick figure at bottom choosing"),
    ("043_3-30", S + "stick figure walking away from car rectangle shape, car with downward arrow below it, small coins flying away from stick figure wallet shape"),
    ("044_3-35", S + "car rectangle shrinking in size with downward arrow, money coins flying away in stream from wallet, month calendar squares passing"),
    ("045_3-40", S + "stick figure on beach with umbrella shape, stick figure holding phone rectangle, both with downward arrows and money stream flowing away"),
    ("046_3-45", S + "stick figure waist deep in pile of bill rectangles, arms raised trying to stay above bills, overwhelmed expression open mouth"),
    ("047_3-50", S + "thin arrow going into investment box rectangle labeled with small percent symbol, money entering box, growth lines on box"),
    ("048_3-55", S + "investment rectangle box with upward arrow coming out, larger money bag emerging from top, taller than input arrow, growth visual"),
    ("049_4-00", S + "simple math flow: small arrow in on left, larger arrow out on right, small circle highlighting difference gap between the two arrows, green accent on gap"),
    ("050_4-05", S + "several coin circles with stick legs running fast, speed lines behind them, stick figure in chair watching them run, relaxed posture"),
    ("051_4-10", S + "stick figure in hammock between two posts, small arrow shape pulling money bag toward money pile by itself, stick figure not working, relaxed"),
    # --- WARREN BUFFETT ---
    ("052_4-15", S + "old stick figure with glasses oval shapes on face, bow tie triangle at neck, one line arm raised with index finger pointing up, wise expression"),
    ("053_4-20", S + "rectangular building with windows, row of stick figures outside it forming queue line, coins going in through door, insurance building visual"),
    ("054_4-25", S + "multiple stick figures with arrows from them all flowing into large rectangular box, coins accumulating inside box, funnel effect"),
    ("055_4-30", S + "rectangular box on left with arrow leading to stock market bar chart on right, bars growing taller, investment flow"),
    ("056_4-35", S + "bar chart bars doubling in height, money bag getting bigger with multiplication symbol beside it, upward trend, growth visual"),
    ("057_4-40", S + "large money pile with dashed border around it, arrow pointing away from pile, stick figure using it freely, dotted line showing it belongs elsewhere"),
    ("058_4-45", S + "building shape with floors stacking upward, bottom floor labeled with dashed lines showing borrowed foundation, upper floors solid, wealth tower"),
    ("059_4-50", S + "yellow triangle warning shape center, magnifying circle hovering over it, small hidden trap door shape below triangle, suspicious eye shapes"),
    # --- DESIGUALDAD DE CREDITO ---
    ("060_4-55", S + "spotlight circle on single bar in bar chart, magnifying circle hovering, other bars in shadow, one highlighted data point"),
    ("061_5-00", S + "row of rich stick figures with top hats, small percent symbol bubble above them, bank giving them coins easily, smiling expressions"),
    ("062_5-05", S + "row of poor stick figures, giant heavy weight block shape pressing down on them from above, struggling curved expressions, weight labeled with large percent symbol"),
    ("063_5-10", S + "two stick figures side by side, left rich figure with tiny bubble above, right poor figure with enormous bubble crushing from above, extreme size difference"),
    ("064_5-15", S + "balance scale, rich stick figure on high left pan floating up light, poor stick figure on low right pan pressed down heavy, tilted beam"),
    ("065_5-20", S + "single small coin circle on left, mountain pile of 100 coin circles on right, long comparison arrow between them pointing right"),
    ("066_5-25", S + "stick figure architect at drawing table with blueprint paper, ruler shape, designing system with arrows pointing to rich figure only"),
    ("067_5-30", S + "four boxes in horizontal chain connected by arrows: empty box, risk box with exclamation, percent box, trap door box at end, domino chain"),
    ("068_5-35", S + "three domino rectangles in falling sequence, first falling onto second falling onto third, each domino labeled with different symbol"),
    ("069_5-40", S + "stick figure carrying enormous heavy block on back, car rectangle beside figure, calendar squares showing many months, bent posture from weight"),
    ("070_5-45", S + "calendar grid with many squares filled in with check marks, stick figure working at each square, exhausted drooping arms, many months passing"),
    ("071_5-50", S + "stick figure with small feather floating above head instead of heavy block, house shape beside figure with upward arrow, light posture upright"),
    ("072_5-55", S + "house shape with upward arrow each year, coin pile growing beside house, simple calendar with arrow showing years passing, automatic growth"),
    ("073_6-00", S + "large balance scale, left pan with rich stick figure and top hat rising high up, right pan with poor stick figure dropping down low, extreme tilt"),
    ("074_6-05", S + "balance scale with red X across beam, scale frozen in tilted position, stick figure looking at broken scale with arms out questioning"),
    ("075_6-10", S + "two stick figures walking paths, left path going up with coins appearing, right path flat with nothing, diverging paths from same start point"),
    # --- PROPUBLICA DATA ---
    ("076_6-15", S + "large rectangle newspaper shape center, magnifying circle in corner, bold lines suggesting headline text areas, document investigative visual"),
    ("077_6-20", S + "row of 25 small stick figures all wearing top hat shapes, standing in neat line, all identical rich figures, large group visual"),
    ("078_6-25", S + "enormous number shape outline center suggesting huge amount, calendar showing five year span, money bag pile in background, large quantity visual"),
    ("079_6-30", S + "two groups: large pile of coins on left labeled with big number, tiny pile of coins on right labeled with small number, drastic size difference"),
    ("080_6-35", S + "worker stick figure with tie, large percent block above worker, small percent symbol above rich figure beside him, huge gap visible"),
    ("081_6-40", S + "bar chart with two bars, short bar on left labeled RICOS 3.4% and tall bar on right labeled TRABAJADOR 22%, two stick figures standing below each bar"),
    ("082_6-45", S + "long arrow spanning gap between short bar and tall bar, six small equal segments marked along arrow showing multiplier, gap measurement visual"),
    ("083_6-50", S + "green checkmark stamp shape, legal document rectangle, balance scale beside it still tilted, legal but unfair visual contrast"),
    ("084_6-55", S + "locked toolbox shape on high shelf, key shape beside toolbox, rich stick figure easily reaching shelf, poor stick figure reaching up unable to reach"),
    ("085_7-00", S + "velvet rope curved line separating left and right, financial tool shapes on left side, rich stick figure inside using them, poor stick figure outside looking in"),
    # --- CONCLUSION ---
    ("086_7-05", S + "single wrench shape center, no labels on it, neutral position, equal space on both sides, neither good nor bad, balanced composition"),
    ("087_7-10", S + "same wrench shape shown twice, rich stick figure on left using it to stack coins upward, poor stick figure on right using it as bandage patch shape"),
    ("088_7-15", S + "rich stick figure with wrench multiplying coins, stack growing upward with multiplication arrows, satisfied expression"),
    ("089_7-20", S + "regular stick figure with light bulb shape above head, gears becoming visible as transparent outlines in background, understanding moment"),
    ("090_7-25", S + "stick figure looking through magnifying circle at system gears now visible, previously hidden gears now shown clearly, discovery visual"),
    ("091_7-30", S + "large Y fork shape, stick figure at base, upward arrow on right path, downward arrow on left path, choice moment, question mark above figure"),
    ("092_7-35", S + "rectangle comment box shape with cursor blink line inside, stick figure beside it with thinking bubble, typing gesture arm position"),
    ("093_7-40", S + "large rounded rectangle thumbs up shape center, two stick figures on either side both pointing at it, excited raised arm posture"),
    ("094_7-45", S + "large bell shape center with notification dot on top, stick figure beside it pressing bell with one arm, notification rings radiating outward"),
    ("095_7-50", S + "bell shape with checkmark inside, stick figure jumping with arms raised in celebration, simple joy posture"),
    ("096_7-55", S + "single stick figure center waving both arms upward in goodbye gesture, big smile, simple white background, no extra text, clean ending frame"),
]

def download_image(idx_name, prompt):
    encoded = urllib.parse.quote(prompt)
    seed = abs(hash(idx_name)) % 9999
    url = f"https://image.pollinations.ai/prompt/{encoded}?width=1280&height=720&nologo=true&seed={seed}&model=flux"
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

print(f"Regenerando {len(images)} imagenes con prompts mejorados...")
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = {executor.submit(download_image, name, prompt): name for name, prompt in images}
    done = 0
    for future in as_completed(futures):
        name, success = future.result()
        done += 1
        print(f"Progreso: {done}/{len(images)}")

print("Completado.")
