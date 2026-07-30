/**
 * Genera `preview/index.html`: una página autónoma que ejecuta el motor de
 * valoración real en el navegador, sin servidor ni base de datos.
 *
 * Se usa para demostrar el producto (por ejemplo en un chat o en un correo) sin
 * desplegar nada. Compila `preview/entry.ts` —que reexporta el mismo motor que
 * usa la aplicación— y lo incrusta en la plantilla `preview/template.html`.
 *
 *   node scripts/build-preview.mjs
 */
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const result = await build({
  entryPoints: [join(root, "preview/entry.ts")],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  write: false,
  logLevel: "warning",
});

const engine = result.outputFiles[0].text;

// Un `</script` dentro del bundle cerraría el bloque inline y rompería la página.
if (/<\/script/i.test(engine)) {
  throw new Error("El bundle contiene «</script»: no se puede incrustar en línea.");
}

const template = await readFile(join(root, "preview/template.html"), "utf8");
if (!template.includes("/*__ENGINE__*/")) {
  throw new Error("La plantilla no contiene el marcador /*__ENGINE__*/.");
}

const html = template.replace("/*__ENGINE__*/", engine);
await writeFile(join(root, "preview/index.html"), html, "utf8");

console.log(`preview/index.html generado (${(html.length / 1024).toFixed(0)} kB, motor ${(engine.length / 1024).toFixed(0)} kB)`);
