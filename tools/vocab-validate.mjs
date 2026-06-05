#!/usr/bin/env node
// Validate generated vocab packs: schema intent + headword provenance + entry integrity.
// Zero deps. Exit 1 on any error. Usage: node tools/vocab-validate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POS = new Set(['n', 'v', 'adj', 'adv', 'prep', 'pron', 'conj', 'det', 'num', 'phr', 'interj', 'modal', 'aux', '']);
const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/vocab/source/cefr-words.json'), 'utf8'));
const sourceSet = new Set(source.map((e) => e.w.toLowerCase()));
// Basic English 850 headwords are also a valid provenance source (foundation track).
const bePath = path.join(ROOT, 'data/vocab/be850-source.json');
if (fs.existsSync(bePath)) { const be = JSON.parse(fs.readFileSync(bePath, 'utf8')); for (const g of Object.values(be)) for (const w of g) sourceSet.add(String(w).toLowerCase()); }

const errors = [];
let totalWords = 0, withGloss = 0, stubs = 0, fileCount = 0;

// CEFR band optional for foundation sections (Basic English words carry their own band if known).
function scanDir(rel, { bandRequired }) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return;
  const seen = new Map(); // per-track dup check (overlap across tracks is allowed)
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    fileCount++;
    const where = `${rel.split('/').pop()}/${f}`;
    let P;
    try { P = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
    catch (e) { errors.push(`${where}: invalid JSON — ${e.message}`); continue; }
    if (!P.id || !Array.isArray(P.words) || (bandRequired && !P.band)) { errors.push(`${where}: missing id/band/words`); continue; }
    if (!P.title || !P.title.en || !P.title.zh) errors.push(`${where}: missing bilingual title`);
    if (P.trick && (!P.trick.heading?.en || !P.trick.heading?.zh || !P.trick.body?.en || !P.trick.body?.zh)) errors.push(`${where}: grammar trick card missing bilingual heading/body`);

    for (const w of P.words) {
      totalWords++;
      if (!w.w || typeof w.w !== 'string') { errors.push(`${where}: word missing headword`); continue; }
      const hw = w.w.toLowerCase();
      if (!sourceSet.has(hw)) errors.push(`${where}: headword "${w.w}" not in sourced list (invented?)`);
      if (seen.has(hw)) errors.push(`${where}: "${hw}" duplicate (also in ${seen.get(hw)})`); else seen.set(hw, P.id);
      if (w.cefr !== undefined && w.cefr !== '' && !CEFR.has(w.cefr)) errors.push(`${where}: "${hw}" bad cefr ${w.cefr}`);
      if (w.pos !== undefined && !POS.has(w.pos)) errors.push(`${where}: "${hw}" bad pos "${w.pos}"`);
      const hasGloss = w.gloss && w.gloss.en && w.gloss.zh;
      if (!hasGloss) { stubs++; errors.push(`${where}: "${hw}" missing gloss{en,zh} (stub not completed)`); continue; }
      withGloss++;
      if (!w.example || typeof w.example !== 'string' || !w.example.trim()) errors.push(`${where}: "${hw}" missing example`);
      else if (w.blank && !w.example.includes(w.blank)) errors.push(`${where}: "${hw}" blank "${w.blank}" not a substring of example`);
    }
  }
}

scanDir('data/vocab/packs', { bandRequired: true });
scanDir('data/vocab/be850', { bandRequired: false });

console.error(`scanned ${fileCount} files, ${totalWords} words; completed=${withGloss} stubs=${stubs}`);
if (errors.length) {
  const show = errors.slice(0, 40);
  console.error(`✗ ${errors.length} error(s):\n` + show.map((e) => '  - ' + e).join('\n') + (errors.length > 40 ? `\n  … +${errors.length - 40} more` : ''));
  process.exit(1);
}
console.log(`✓ ${totalWords} vocab words valid across ${fileCount} files`);
