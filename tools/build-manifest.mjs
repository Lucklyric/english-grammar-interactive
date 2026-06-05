#!/usr/bin/env node
// Assemble data/manifest.json from every data/lessons/*.json. Usage: node tools/build-manifest.mjs > data/manifest.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'data/lessons');
const CATEGORIES = [
  { id: 'foundations',        label: { en: 'Foundations', zh: '语法基础' } },
  { id: 'verbs-tenses-mood',  label: { en: 'Verbs, tenses & mood', zh: '动词 · 时态 · 语气' } },
  { id: 'clauses',            label: { en: 'Clauses', zh: '从句' } },
  { id: 'sentence-structure', label: { en: 'Sentence structure', zh: '句子结构' } },
  { id: 'parts-of-speech',    label: { en: 'Parts of speech', zh: '词类' } },
  { id: 'punctuation-usage',  label: { en: 'Punctuation & usage', zh: '标点 · 用法辨析' } },
];

const lessons = fs.readdirSync(dir).filter((f) => /^\d{2}\.json$/.test(f)).map((f) => {
  const L = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return { id: L.id, slug: L.slug, order: L.order, category: L.category, shape: L.shape, title: L.title };
}).sort((a, b) => a.order - b.order);

process.stdout.write(JSON.stringify({ version: 1, categories: CATEGORIES, lessons }, null, 2) + '\n');
