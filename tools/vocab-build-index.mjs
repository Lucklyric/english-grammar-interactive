#!/usr/bin/env node
// Build data/vocab/index.json from the pack files (+ foundation sections if present).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vdir = path.join(ROOT, 'data/vocab');
const packsDir = path.join(vdir, 'packs');
const beDir = path.join(vdir, 'be850');

const packs = fs.readdirSync(packsDir).filter((f) => f.endsWith('.json')).map((f) => {
  const P = JSON.parse(fs.readFileSync(path.join(packsDir, f), 'utf8'));
  return { id: P.id, band: P.band, order: P.order, size: P.words.length, title: P.title };
}).sort((a, b) => a.order - b.order);

let sections = [];
if (fs.existsSync(beDir)) {
  sections = fs.readdirSync(beDir).filter((f) => f.endsWith('.json')).map((f) => {
    const S = JSON.parse(fs.readFileSync(path.join(beDir, f), 'utf8'));
    return { id: S.id, order: S.order, size: S.words.length, title: S.title };
  }).sort((a, b) => a.order - b.order);
}

const index = {
  version: 1,
  tracks: [
    { id: 'foundation', title: { en: 'Basic English 850', zh: '基础英语 850 词' },
      blurb: { en: 'The 850-word core + the grammar tricks that let them say almost anything.', zh: '850 核心词 + 让你“几乎能表达一切”的语法技巧。' },
      sections },
    { id: 'advanced', title: { en: 'CEFR A1 → C2 (CELPIP 10)', zh: 'CEFR A1 → C2（CELPIP 10）' },
      blurb: { en: 'Type your way up ~9,800 words from A1 to C2, with spaced review.', zh: '用打字记忆约 9800 个 A1–C2 单词，配合间隔复习。' },
      packs },
  ],
};
fs.writeFileSync(path.join(vdir, 'index.json'), JSON.stringify(index, null, 0) + '\n');

// Flat word map for cross-pack daily review: w -> { g:{en,zh}, e:example, b:blank, c:cefr, p:pos }
const all = {};
const addWords = (dir) => { if (!fs.existsSync(dir)) return; for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const P = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const w of P.words) if (w.gloss) all[w.w] = { g: w.gloss, e: w.example || '', b: w.blank || '', c: w.cefr, p: w.pos || '' };
} };
addWords(packsDir); addWords(beDir);
fs.writeFileSync(path.join(vdir, 'all-words.json'), JSON.stringify(all) + '\n');
console.log(`index.json: ${sections.length} foundation sections, ${packs.length} advanced packs; all-words.json: ${Object.keys(all).length} words`);
