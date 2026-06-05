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

const packsDir = path.join(ROOT, 'data/vocab/packs');
const files = fs.readdirSync(packsDir).filter((f) => f.endsWith('.json')).sort();

const errors = [];
const seenWords = new Map();   // headword -> pack (cross-pack dup check)
let totalWords = 0, withGloss = 0, stubs = 0;

for (const f of files) {
  const where = `packs/${f}`;
  let P;
  try { P = JSON.parse(fs.readFileSync(path.join(packsDir, f), 'utf8')); }
  catch (e) { errors.push(`${where}: invalid JSON — ${e.message}`); continue; }
  if (!P.id || !P.band || !Array.isArray(P.words)) { errors.push(`${where}: missing id/band/words`); continue; }
  if (!P.title || !P.title.en || !P.title.zh) errors.push(`${where}: missing bilingual title`);

  for (const w of P.words) {
    totalWords++;
    if (!w.w || typeof w.w !== 'string') { errors.push(`${where}: word missing headword`); continue; }
    const hw = w.w.toLowerCase();
    // provenance
    if (!sourceSet.has(hw)) errors.push(`${where}: headword "${w.w}" not in sourced CEFR list (invented?)`);
    // cross-pack duplicate
    if (seenWords.has(hw)) errors.push(`${where}: "${hw}" duplicate (also in ${seenWords.get(hw)})`);
    else seenWords.set(hw, P.id);
    // band / pos
    if (!CEFR.has(w.cefr)) errors.push(`${where}: "${hw}" bad cefr ${w.cefr}`);
    if (w.pos !== undefined && !POS.has(w.pos)) errors.push(`${where}: "${hw}" bad pos "${w.pos}"`);
    // completed entry checks (a stub still has def/empty gloss)
    const hasGloss = w.gloss && w.gloss.en && w.gloss.zh;
    if (!hasGloss) { stubs++; errors.push(`${where}: "${hw}" missing gloss{en,zh} (stub not completed)`); continue; }
    withGloss++;
    if (!w.example || typeof w.example !== 'string' || !w.example.trim()) errors.push(`${where}: "${hw}" missing example`);
    else if (w.blank && !w.example.includes(w.blank)) errors.push(`${where}: "${hw}" blank "${w.blank}" not a substring of example`); // blank "" = gap-fill disabled (ok)
  }
}

console.error(`scanned ${files.length} packs, ${totalWords} words; completed=${withGloss} stubs=${stubs}`);
if (errors.length) {
  const show = errors.slice(0, 40);
  console.error(`✗ ${errors.length} error(s):\n` + show.map((e) => '  - ' + e).join('\n') + (errors.length > 40 ? `\n  … +${errors.length - 40} more` : ''));
  process.exit(1);
}
console.log(`✓ ${totalWords} vocab words valid across ${files.length} packs`);
