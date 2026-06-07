#!/usr/bin/env node
// Build data/eea/index.json from the section registry + the per-unit files.
//
// Identity is composite SId-Uid (e.g. "s1-01", "s2-c01"): section id + local unit id.
// Each unit file lives at data/eea/units/<sid>-<u>.json. This tool also NORMALIZES legacy
// extractor output named <u>.json (with `section` + `id` fields) into the SId-Uid scheme:
// it renames the file to <sid>-<u>.json and stamps `uid`, `sid`, `u` onto its contents.
//
// Adding a unit  = drop a JSON in units/ (any name) with a `section` field → rebuild.
// Adding a section = add an entry to sections.json → rebuild.
//
// Usage: node tools/eea-build-index.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EEA = path.join(ROOT, 'data', 'eea');
const UNITS = path.join(EEA, 'units');

function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }
function writeJson(f, o) { fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n'); }
function localId(u) { return String(u.u ?? u.id ?? '').trim(); }
function numKey(id) { const m = String(id).match(/(\d+)/); return m ? Number(m[1]) : 9999; }

const sections = readJson(path.join(EEA, 'sections.json'));
const sectionById = new Map(sections.map((s) => [s.id, s]));

const files = fs.readdirSync(UNITS).filter((f) => f.endsWith('.json'));
const unitsBySection = new Map(sections.map((s) => [s.id, []]));
const warnings = [];

for (const file of files) {
  const full = path.join(UNITS, file);
  const data = readJson(full);
  const sid = data.sid || data.section;
  const u = localId(data);
  if (!sid || !u) { warnings.push(`${file}: missing section/unit id — skipped`); continue; }
  if (!sectionById.has(sid)) { warnings.push(`${file}: unknown section "${sid}" — skipped`); continue; }
  const uid = `${sid}-${u}`;

  // Normalize file contents to the canonical shape + filename.
  let changed = false;
  if (data.uid !== uid) { data.uid = uid; changed = true; }
  if (data.sid !== sid) { data.sid = sid; changed = true; }
  if (data.u !== u) { data.u = u; changed = true; }
  if ('id' in data) { delete data.id; changed = true; }
  if ('section' in data) { delete data.section; changed = true; }
  // canonical field order
  const ordered = { uid, sid, u, custom: !!data.custom, title: data.title, tense: data.tense || '', level: data.level || 1, phrases: data.phrases || [] };

  const targetName = `${uid}.json`;
  const targetFull = path.join(UNITS, targetName);
  if (file !== targetName) {
    writeJson(targetFull, ordered);
    if (fs.existsSync(full) && full !== targetFull) fs.unlinkSync(full);
  } else if (changed || JSON.stringify(readJson(full)) !== JSON.stringify(ordered)) {
    writeJson(targetFull, ordered);
  }

  unitsBySection.get(sid).push({
    uid, sid, u, order: numKey(u) + (ordered.custom ? 1000 : 0),
    custom: ordered.custom, title: ordered.title, tense: ordered.tense,
    level: ordered.level, size: (ordered.phrases || []).length,
  });
}

const indexSections = [...sections]
  .sort((a, b) => (a.order || 0) - (b.order || 0))
  .map((sec) => ({
    id: sec.id, order: sec.order, title: sec.title,
    units: unitsBySection.get(sec.id).sort((a, b) => a.order - b.order),
  }));

const index = { version: 1, sections: indexSections };
writeJson(path.join(EEA, 'index.json'), index);

const totalUnits = indexSections.reduce((n, s) => n + s.units.length, 0);
const totalPhrases = indexSections.reduce((n, s) => n + s.units.reduce((m, u) => m + u.size, 0), 0);
console.log(`eea index built: ${indexSections.length} sections, ${totalUnits} units, ${totalPhrases} phrases`);
for (const w of warnings) console.warn('  warn:', w);
