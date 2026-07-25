/**
 * Conversor de Markdown a HTML sin dependencias.
 *
 * Por que no una libreria: el contenido que renderizamos lo produce nuestro
 * propio modelo o nuestro equipo, el subconjunto de Markdown que usamos es
 * pequeno y una dependencia menos es una superficie de ataque menos.
 *
 * Seguridad: se escapa TODO el HTML de entrada antes de aplicar ninguna regla,
 * de modo que el resultado nunca puede contener etiquetas del texto original.
 * Los enlaces se limitan a los esquemas http, https y mailto.
 */

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (/^(https?:\/\/|mailto:|\/)/i.test(trimmed)) return trimmed;
  return null;
}

/** Formato dentro de una linea: codigo, negrita, cursiva, enlaces. */
function inline(text: string): string {
  let out = text;

  // El codigo va primero: su contenido no debe recibir mas transformaciones.
  const codeSpans: string[] = [];
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => {
    codeSpans.push(code);
    return `\u0000CODE${codeSpans.length - 1}\u0000`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, href: string) => {
    const safe = safeHref(href);
    if (!safe) return label;
    const external = safe.startsWith('http');
    return `<a href="${safe}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });

  out = out.replace(/\u0000CODE(\d+)\u0000/g, (_m, index: string) => `<code>${codeSpans[Number(index)]}</code>`);

  return out;
}

export function markdownToHtml(markdown: string): string {
  const source = escapeHtml(markdown.replace(/\r\n/g, '\n'));
  const lines = source.split('\n');
  const html: string[] = [];

  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let paragraph: string[] = [];
  let tableBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableBuffer.length < 2) {
      // No es una tabla valida: se devuelve como parrafos.
      tableBuffer.forEach((line) => html.push(`<p>${inline(line)}</p>`));
      tableBuffer = [];
      return;
    }

    const cells = (row: string) =>
      row
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());

    const header = cells(tableBuffer[0]);
    const body = tableBuffer.slice(2).map(cells);

    html.push('<table><thead><tr>');
    header.forEach((c) => html.push(`<th>${inline(c)}</th>`));
    html.push('</tr></thead><tbody>');
    body.forEach((row) => {
      html.push('<tr>');
      row.forEach((c) => html.push(`<td>${inline(c)}</td>`));
      html.push('</tr>');
    });
    html.push('</tbody></table>');
    tableBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Bloques de codigo
    if (/^```/.test(line.trim())) {
      if (inCodeBlock) {
        html.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        flushParagraph();
        closeList();
        flushTable();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Tablas
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph();
      closeList();
      tableBuffer.push(line.trim());
      continue;
    }
    if (tableBuffer.length) flushTable();

    // Linea en blanco
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    // Separador
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph();
      closeList();
      html.push('<hr />');
      continue;
    }

    // Encabezados
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(6, heading[1].length);
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    // Cita
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      html.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    // Listas
    const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (unordered || ordered) {
      flushParagraph();
      const wanted: 'ul' | 'ol' = unordered ? 'ul' : 'ol';
      if (listType !== wanted) {
        closeList();
        html.push(`<${wanted}>`);
        listType = wanted;
      }
      html.push(`<li>${inline((unordered ?? ordered)![1])}</li>`);
      continue;
    }

    // Parrafo
    closeList();
    paragraph.push(line.trim());
  }

  if (inCodeBlock && codeBuffer.length) html.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
  flushTable();
  flushParagraph();
  closeList();

  return html.join('\n');
}

/** Texto plano a partir de Markdown (para extractos y meta descripciones). */
export function markdownToPlain(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_>#|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
