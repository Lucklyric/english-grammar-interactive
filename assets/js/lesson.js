import { initLang, getLang, toggleLang, otherLang, t, pick } from './i18n.js';
import { annotateToHTML } from './annotate.js';
import { renderQuiz } from './quiz.js';
import { markOpened, markComplete, isComplete, recordQuiz } from './progress.js';

const $ = (s, r = document) => r.querySelector(s);
const id = new URLSearchParams(location.search).get('id');

function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

async function main() {
  initLang();
  wireToggle();
  let manifest, tagsDoc;
  try {
    [manifest, tagsDoc] = await Promise.all([
      fetch('data/manifest.json').then((r) => r.json()),
      fetch('data/tags.json').then((r) => r.json()),
    ]);
  } catch { $('#lesson').innerHTML = errorCard(t('notFound')); return; }

  const entry = manifest.lessons.find((l) => l.id === id);
  if (!entry) { $('#lesson').innerHTML = errorCard(t('notFound')); document.title = t('notFound'); return; }

  let L;
  try {
    L = await fetch(`data/lessons/${id}.json`).then((r) => { if (!r.ok) throw new Error('http'); return r.json(); });
  } catch { $('#lesson').innerHTML = `<div class="card"><p>${t('notFound')}</p><button onclick="location.reload()">${t('retry')}</button></div>`; return; }

  markOpened(id);
  const tags = Object.assign({}, tagsDoc.tags, Object.fromEntries((L.tags || []).map((x) => [x.id, x])));
  const render = () => { paint(L, entry, manifest, tags); syncToggleLabel(); };
  document.addEventListener('langchange', render);
  render();
}

function wireToggle() {
  const btn = $('#lang-toggle');
  if (btn) btn.addEventListener('click', () => toggleLang());
  syncToggleLabel();
}
function syncToggleLabel() { const btn = $('#lang-toggle'); if (btn) btn.textContent = otherLang() === 'zh' ? '中文' : 'EN'; }

function paint(L, entry, manifest, tags) {
  const lang = getLang();
  document.title = `${pick(L.title)} · Grammar`;
  const root = $('#lesson'); root.innerHTML = '';

  const head = document.createElement('div'); head.className = 'lesson-head';
  head.innerHTML = `<p class="crumb"><a href="index.html">←</a> <span class="shape-badge">${L.shape}</span></p><h1>${escapeHtml(pick(L.title))}</h1><p class="summary">${escapeHtml(pick(L.summary))}</p>`;
  root.append(head);

  // Concepts
  const cs = section('concepts', t('concepts'));
  for (const c of L.concepts) {
    const d = document.createElement('article'); d.className = 'concept';
    d.innerHTML = `<h3>${escapeHtml(pick(c.heading))}</h3><p>${escapeHtml(pick(c.body))}</p>`;
    if (c.exampleRefs?.length) {
      const refs = c.exampleRefs.map((rid) => L.examples.find((e) => e.id === rid)).filter(Boolean);
      for (const e of refs) { const ex = document.createElement('p'); ex.className = 'example inline'; ex.innerHTML = annotateToHTML(e.text, e.annotations, tags, lang); d.append(ex); }
    }
    cs.append(d);
  }
  root.append(cs);

  // Examples + legend
  const es = section('examples', t('examples'));
  for (const e of L.examples) {
    const d = document.createElement('div'); d.className = 'example-card';
    const line = document.createElement('p'); line.className = 'example'; line.innerHTML = annotateToHTML(e.text, e.annotations, tags, lang); d.append(line);
    if (e.note) { const n = document.createElement('p'); n.className = 'example-note'; n.textContent = pick(e.note); d.append(n); }
    es.append(d);
  }
  es.append(legend(L, tags, lang));
  root.append(es);

  // Quiz
  const qs = section('quiz', t('quiz'));
  for (const q of L.quizzes) qs.append(renderQuiz(q, (qid, ok) => recordQuiz(L.id, qid, ok)));
  root.append(qs);

  // Dialogue
  if (L.dialogue) {
    const ds = section('dialogue', `${t('dialogue')} · ${escapeHtml(pick(L.dialogue.title))}`);
    for (const ln of L.dialogue.lines) {
      const p = document.createElement('p'); p.className = 'dline';
      p.innerHTML = `<b class="speaker">${escapeHtml(ln.speaker)}</b> ` + annotateToHTML(ln.text, ln.annotations || [], tags, lang);
      if (ln.note) { const n = document.createElement('span'); n.className = 'dline-note'; n.textContent = ' ' + pick(ln.note); p.append(n); }
      ds.append(p);
    }
    root.append(ds);
  }

  // Footer: source, complete, prev/next
  const foot = document.createElement('div'); foot.className = 'lesson-foot';
  const src = document.createElement('a'); src.href = L.source.youtube; src.target = '_blank'; src.rel = 'noopener'; src.className = 'source-link'; src.textContent = `▶ ${t('source')}`;
  const done = document.createElement('button'); done.className = 'complete-btn';
  const refreshDone = () => { const c = isComplete(L.id); done.textContent = c ? `✓ ${t('completed')}` : t('complete'); done.classList.toggle('is-done', c); };
  done.addEventListener('click', () => { markComplete(L.id); refreshDone(); }); refreshDone();
  foot.append(src, done);
  root.append(foot, prevNext(entry, manifest));
}

function section(id, title) { const s = document.createElement('section'); s.className = 'lesson-section'; s.id = `sec-${id}`; const h = document.createElement('h2'); h.innerHTML = title; s.append(h); return s; }

function legend(L, tags, lang) {
  const used = new Set();
  for (const e of L.examples) for (const a of (e.annotations || [])) used.add(a.tag);
  if (L.dialogue) for (const ln of L.dialogue.lines) for (const a of (ln.annotations || [])) used.add(a.tag);
  if (!used.size) return document.createComment('no-legend');
  const d = document.createElement('div'); d.className = 'legend';
  const h = document.createElement('span'); h.className = 'legend-title'; h.textContent = t('legend') + ': '; d.append(h);
  for (const tid of used) {
    const def = tags[tid] || {};
    const s = document.createElement('span'); s.className = `legend-item ul-${def.underline || 'solid'}`;
    s.style.setProperty('--anno-color', def.color || '#333');
    s.textContent = `${def.abbr || tid} ${(def.label && (def.label[lang] || def.label.en)) || tid}`;
    d.append(s);
  }
  return d;
}

function prevNext(entry, manifest) {
  const ordered = [...manifest.lessons].sort((a, b) => a.order - b.order);
  const i = ordered.findIndex((l) => l.id === entry.id);
  const nav = document.createElement('nav'); nav.className = 'prevnext';
  nav.append(i > 0 ? link(ordered[i - 1].id, '‹ ' + pick(ordered[i - 1].title), 'prev') : spacer());
  nav.append(i < ordered.length - 1 ? link(ordered[i + 1].id, pick(ordered[i + 1].title) + ' ›', 'next') : spacer());
  return nav;
}
function link(id, label, cls) { const a = document.createElement('a'); a.href = `lesson.html?id=${id}`; a.textContent = label; a.className = `pn ${cls}`; return a; }
function spacer() { const s = document.createElement('span'); s.className = 'pn-spacer'; return s; }
function errorCard(msg) { return `<div class="card not-found"><h1>${msg}</h1><p><a href="index.html">${t('backHome')}</a></p></div>`; }

main();
