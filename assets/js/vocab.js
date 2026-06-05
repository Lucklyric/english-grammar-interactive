import { initLang, getLang, toggleLang, otherLang, t, pick } from './i18n.js';
import { store } from './srs.js';

const $ = (s, r = document) => r.querySelector(s);
const STR = {
  zh: { title: '词汇训练', daily: '今日复习', due: '待复习', mastered: '已掌握', words: '词', learn: '开始', section: '语法 + 词', noDue: '今天没有待复习的词 — 去学新词吧！', reset: '重置进度', start: '开始本组' },
  en: { title: 'Vocabulary Trainer', daily: 'Daily review', due: 'due', mastered: 'mastered', words: 'words', learn: 'Start', section: 'grammar + words', noDue: 'No words due today — learn some new ones!', reset: 'Reset progress', start: 'Start pack' },
};
const s = (k) => (STR[getLang()] || STR.en)[k] || k;

let INDEX = { tracks: [] }, ALL = null;

async function main() {
  initLang(); wireChrome();
  INDEX = await fetch('data/vocab/index.json').then((r) => r.json()).catch(() => ({ tracks: [] }));
  ALL = await fetch('data/vocab/all-words.json').then((r) => r.json()).catch(() => ({}));
  document.addEventListener('langchange', render);
  render();
}

function render() {
  sync();
  const lang = getLang();
  const allWords = Object.keys(ALL || {});
  const dueCount = store.due(allWords).length;
  const mastered = store.masteredCount(allWords);
  $('#vtitle').textContent = s('title');
  $('#daily-label').textContent = s('daily');
  $('#daily-count').textContent = `${dueCount} ${s('due')}`;
  $('#daily-btn').classList.toggle('disabled', dueCount === 0);
  $('#mastery').textContent = `${mastered} / ${allWords.length} ${s('mastered')}`;
  $('#mastery-bar').style.width = allWords.length ? `${mastered / allWords.length * 100}%` : '0%';
  $('#reset').textContent = s('reset');

  const root = $('#tracks'); root.innerHTML = '';
  for (const track of INDEX.tracks) {
    const sec = document.createElement('section'); sec.className = 'vtrack';
    sec.innerHTML = `<h2>${escapeHtml(pick(track.title))}</h2>${track.blurb ? `<p class="vblurb">${escapeHtml(pick(track.blurb))}</p>` : ''}`;
    const grid = document.createElement('div'); grid.className = 'vgrid';
    const items = track.id === 'foundation' ? (track.sections || []) : (track.packs || []);
    if (!items.length) { const e = document.createElement('p'); e.className = 'vempty'; e.textContent = '—'; grid.append(e); }
    for (const it of items) grid.append(card(it, track.id, lang));
    sec.append(grid); root.append(sec);
  }
}

function card(it, trackId, lang) {
  const href = trackId === 'foundation' ? `drill.html?section=${it.id}` : `drill.html?pack=${it.id}`;
  const a = document.createElement('a'); a.href = href; a.className = 'vcard';
  const badge = it.band || (trackId === 'foundation' ? 'BE' : '');
  a.innerHTML = `<span class="vc-badge">${escapeHtml(badge)}</span>`
    + `<span class="vc-title">${escapeHtml(pick(it.title))}</span>`
    + `<span class="vc-size">${it.size} ${s('words')}${trackId === 'foundation' ? ' · ' + s('section') : ''}</span>`;
  return a;
}

function wireChrome() {
  $('#lang-toggle').addEventListener('click', () => toggleLang());
  $('#daily-btn').addEventListener('click', (e) => { if ($('#daily-btn').classList.contains('disabled')) { e.preventDefault(); alert(s('noDue')); } });
  $('#reset').addEventListener('click', () => { if (confirm(s('reset') + '?')) { store.reset(); render(); } });
  sync();
}
function sync() { const b = $('#lang-toggle'); if (b) b.textContent = otherLang() === 'zh' ? '中文' : 'EN'; }
function escapeHtml(x) { return String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

main();
