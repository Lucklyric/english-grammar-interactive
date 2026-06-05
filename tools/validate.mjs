#!/usr/bin/env node
// Validate every data/lessons/*.json against the schema's intent + spec §10 gates.
// Zero dependencies. Exit 1 on any error. Usage: node tools/validate.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSpans, findOverlaps, checkCounts } from './lib/lint.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = path.resolve(ROOT, '..');               // Personal/english-grammar
const tags = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/tags.json'), 'utf8')).tags;
const lessonsDir = path.join(ROOT, 'data/lessons');
const files = fs.readdirSync(lessonsDir).filter((f) => /^\d{2}\.json$/.test(f)).sort();

const errors = [];
const slugs = new Map(), ids = new Map();
const transcriptCache = new Map();
const readTranscript = (rel) => {
  if (!transcriptCache.has(rel)) {
    const p = path.join(VAULT, rel);
    transcriptCache.set(rel, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
  }
  return transcriptCache.get(rel);
};
const biling = (o, where) => {
  if (!o || typeof o.en !== 'string' || !o.en.trim() || typeof o.zh !== 'string' || !o.zh.trim())
    errors.push(`${where}: missing/empty {en,zh}`);
};

for (const f of files) {
  const where = `lessons/${f}`;
  let L;
  try { L = JSON.parse(fs.readFileSync(path.join(lessonsDir, f), 'utf8')); }
  catch (e) { errors.push(`${where}: invalid JSON — ${e.message}`); continue; }

  if (`${L.id}.json` !== f) errors.push(`${where}: id "${L.id}" != filename`);
  if (ids.has(L.id)) errors.push(`${where}: duplicate id ${L.id}`); else ids.set(L.id, f);
  if (slugs.has(L.slug)) errors.push(`${where}: duplicate slug ${L.slug}`); else slugs.set(L.slug, f);
  if (!['tiny','standard','deep-dive'].includes(L.shape)) errors.push(`${where}: bad shape ${L.shape}`);
  biling(L.title, `${where}.title`); biling(L.summary, `${where}.summary`);
  if (!L.source || !L.source.script) errors.push(`${where}: missing source.script`);

  const tagIds = new Set(Object.keys(tags));
  for (const t of (L.tags || [])) { tagIds.add(t.id); biling(t.label, `${where}.tags.${t.id}.label`); }

  const exampleIds = new Set((L.examples || []).map((e) => e.id));
  const conceptIds = new Set((L.concepts || []).map((c) => c.id));
  for (const c of (L.concepts || [])) {
    biling(c.heading, `${where}.concepts.${c.id}.heading`);
    biling(c.body, `${where}.concepts.${c.id}.body`);
    for (const r of (c.exampleRefs || [])) if (!exampleIds.has(r)) errors.push(`${where}.concepts.${c.id}: exampleRef ${r} missing`);
    if (c.sourceRef) {
      const tx = readTranscript(L.source.script);
      if (tx === null) errors.push(`${where}: transcript ${L.source.script} not found for sourceRef`);
      else if (!tx.includes(c.sourceRef)) errors.push(`${where}.concepts.${c.id}: sourceRef not a verbatim substring of transcript`);
    }
  }

  for (const e of (L.examples || [])) {
    for (const a of (e.annotations || [])) if (!tagIds.has(a.tag)) errors.push(`${where}.examples.${e.id}: undefined tag "${a.tag}"`);
    try {
      const spans = resolveSpans(e.text, e.annotations || []);
      const ov = findOverlaps(spans);
      if (ov.length) errors.push(`${where}.examples.${e.id}: ${ov.length} overlapping annotation span(s)`);
    } catch (err) { errors.push(`${where}.examples.${e.id}: ${err.message}`); }
  }

  for (const q of (L.quizzes || [])) {
    if (q.type === 'mcq') {
      const cids = (q.choices || []).map((c) => c.id);
      if (!cids.includes(q.answer)) errors.push(`${where}.quiz.${q.id}: answer "${q.answer}" not a choice id`);
      const texts = (q.choices || []).map((c) => JSON.stringify(c.text));
      if (new Set(texts).size !== texts.length) errors.push(`${where}.quiz.${q.id}: duplicate choice text`);
      for (const c of (q.choices || [])) biling(c.text, `${where}.quiz.${q.id}.choice.${c.id}`);
    } else if (q.type === 'fill') {
      if (!(q.answers || []).length) errors.push(`${where}.quiz.${q.id}: empty answers[]`);
    } else if (q.type === 'error') {
      if (!q.sentence || !q.fix) errors.push(`${where}.quiz.${q.id}: error needs sentence+fix`);
    } else errors.push(`${where}.quiz.${q.id}: unknown type ${q.type}`);
    if (q.explain) biling(q.explain, `${where}.quiz.${q.id}.explain`);
    for (const r of (q.refs || [])) if (!exampleIds.has(r) && !conceptIds.has(r)) errors.push(`${where}.quiz.${q.id}: ref ${r} missing`);
  }

  if (L.dialogue) {
    biling(L.dialogue.title, `${where}.dialogue.title`);
    for (const ln of (L.dialogue.lines || [])) {
      for (const a of (ln.annotations || [])) if (!tagIds.has(a.tag)) errors.push(`${where}.dialogue: undefined tag "${a.tag}"`);
      try { if (findOverlaps(resolveSpans(ln.text, ln.annotations || [])).length) errors.push(`${where}.dialogue: overlapping spans`); }
      catch (err) { errors.push(`${where}.dialogue: ${err.message}`); }
    }
  }

  for (const issue of checkCounts(L.shape, {
    concepts: (L.concepts || []).length, examples: (L.examples || []).length, quizzes: (L.quizzes || []).length,
  })) errors.push(`${where}: ${issue}`);
}

const manifestPath = path.join(ROOT, 'data/manifest.json');
if (fs.existsSync(manifestPath)) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const mIds = new Set(m.lessons.map((l) => l.id));
  for (const id of ids.keys()) if (!mIds.has(id)) errors.push(`manifest: lesson ${id} present on disk but missing from manifest`);
  for (const l of m.lessons) if (!ids.has(l.id)) errors.push(`manifest: lesson ${l.id} listed but file missing`);
  if (mIds.has('44')) errors.push('manifest: id 44 must not exist');
}

if (errors.length) { console.error(`✗ ${errors.length} validation error(s):\n` + errors.map((e) => '  - ' + e).join('\n')); process.exit(1); }
console.log(`✓ ${files.length} lesson(s) valid`);
