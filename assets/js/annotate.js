import { resolveSpans } from '../../tools/lib/lint.mjs';

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Render text with non-overlapping annotation spans into safe HTML.
// Each span: colored text + underline style + visually-hidden aria label + hover abbr.
export function annotateToHTML(text, annotations, tags, lang) {
  let spans = [];
  try { spans = resolveSpans(text, annotations || []); } catch { spans = []; }
  spans.sort((a, b) => a.start - b.start);
  let out = '', cursor = 0;
  for (const s of spans) {
    if (s.start < cursor) continue; // skip any overlap defensively
    out += esc(text.slice(cursor, s.start));
    const def = tags[s.tag] || { abbr: s.tag, color: 'inherit', underline: 'solid', label: { en: s.tag, zh: s.tag } };
    const label = (def.label && (def.label[lang] || def.label.en)) || s.tag;
    out += `<span class="anno" style="--anno-color:${esc(def.color)};--anno-underline:${esc(def.underline)}" `
        + `data-abbr="${esc(def.abbr)}" aria-label="${esc(label)}" title="${esc(label)}">`
        + esc(text.slice(s.start, s.end))
        + `<sup class="anno-abbr" aria-hidden="true">${esc(def.abbr)}</sup></span>`;
    cursor = s.end;
  }
  out += esc(text.slice(cursor));
  return out;
}
