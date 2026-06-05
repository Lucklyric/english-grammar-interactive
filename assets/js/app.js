import { initLang, getLang, toggleLang, otherLang, t, pick } from './i18n.js';
import { completedCount, lessonState, resetAll } from './progress.js';

const $ = (s, r = document) => r.querySelector(s);

const CATEGORIES = [
  { id: 'foundations',        label: { en: 'Foundations', zh: '语法基础' } },
  { id: 'verbs-tenses-mood',  label: { en: 'Verbs, tenses & mood', zh: '动词 · 时态 · 语气' } },
  { id: 'clauses',            label: { en: 'Clauses', zh: '从句' } },
  { id: 'sentence-structure', label: { en: 'Sentence structure', zh: '句子结构' } },
  { id: 'parts-of-speech',    label: { en: 'Parts of speech', zh: '词类' } },
  { id: 'punctuation-usage',  label: { en: 'Punctuation & usage', zh: '标点 · 用法辨析' } },
];

let MANIFEST = { lessons: [] };

async function main() {
  initLang();
  wireChrome();
  try { MANIFEST = await fetch('data/manifest.json').then((r) => r.json()); } catch { MANIFEST = { lessons: [] }; }
  document.addEventListener('langchange', render);
  $('#search').addEventListener('input', render);
  render();
}

function wireChrome() {
  const btn = $('#lang-toggle'); if (btn) { btn.addEventListener('click', () => toggleLang()); syncToggle(); }
  const reset = $('#reset'); if (reset) reset.addEventListener('click', () => { if (confirm(t('resetProgress') + '?')) { resetAll(); render(); } });
}
function syncToggle() { const b = $('#lang-toggle'); if (b) b.textContent = otherLang() === 'zh' ? '中文' : 'EN'; }

function render() {
  syncToggle();
  const lang = getLang();
  const q = ($('#search').value || '').trim().toLowerCase();
  const all = [...MANIFEST.lessons].sort((a, b) => a.order - b.order);
  const match = (l) => !q || pick(l.title).toLowerCase().includes(q) || (l.title.en + l.title.zh + (l.keywords || '')).toLowerCase().includes(q) || l.id.includes(q);
  const shown = all.filter(match);

  // tagline + progress
  $('#tagline').textContent = t('tagline');
  const done = completedCount(), total = all.length;
  $('#progress-strip').textContent = `${done} / ${total} ${t('done')}`;
  $('#progress-bar').style.width = total ? `${(done / total) * 100}%` : '0%';
  $('#search').placeholder = t('search');
  $('#reset').textContent = t('resetProgress');

  // flat list
  const allWrap = $('#all'); allWrap.innerHTML = `<h2>${t('allLessons')} <span class="count">${shown.length}</span></h2>`;
  const grid = document.createElement('div'); grid.className = 'card-grid';
  for (const l of shown) grid.append(card(l, lang));
  allWrap.append(grid);

  // categories
  const cats = $('#categories'); cats.innerHTML = '';
  for (const cat of CATEGORIES) {
    const inCat = shown.filter((l) => l.category === cat.id);
    if (!inCat.length) continue;
    const sec = document.createElement('section'); sec.className = 'category';
    sec.innerHTML = `<h2>${escapeHtml(pick(cat.label))} <span class="count">${inCat.length}</span></h2>`;
    const g = document.createElement('div'); g.className = 'card-grid';
    for (const l of inCat) g.append(card(l, lang));
    sec.append(g); cats.append(sec);
  }
}

function card(l, lang) {
  const a = document.createElement('a'); a.href = `lesson.html?id=${l.id}`; a.className = 'lesson-card';
  if (lessonState(l.id).complete) a.classList.add('is-complete');
  a.innerHTML = `<span class="lc-id">${l.id}</span>`
    + `<span class="lc-title">${escapeHtml(pick(l.title))}</span>`
    + `<span class="lc-meta"><span class="lc-shape">${l.shape}</span>${lessonState(l.id).complete ? '<span class="lc-check">✓</span>' : ''}</span>`;
  return a;
}

function escapeHtml(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

main();
