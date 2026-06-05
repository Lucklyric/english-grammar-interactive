import { initLang, getLang, toggleLang, otherLang, t, pick } from './i18n.js';
import { store } from './srs.js';

const $ = (s, r = document) => r.querySelector(s);
const STR = {
  zh: { title: '词汇训练', daily: '今日复习', due: '待复习', mastered: '已掌握', words: '词', learn: '开始', section: '语法 + 词', noDue: '今天没有待复习的词 — 去学新词吧！', reset: '重置进度', start: '开始', order: '顺序', mode: '模式', cancel: '取消' },
  en: { title: 'Vocabulary Trainer', daily: 'Daily review', due: 'due', mastered: 'mastered', words: 'words', learn: 'Start', section: 'grammar + words', noDue: 'No words due today — learn some new ones!', reset: 'Reset progress', start: 'Start', order: 'Order', mode: 'Mode', cancel: 'Cancel' },
};
const s = (k) => (STR[getLang()] || STR.en)[k] || k;

const ORDERS = [{ v: 'sequence', en: 'Sequence', zh: '顺序' }, { v: 'shuffle', en: 'Shuffle', zh: '随机' }];
const MODES = [
  { v: 'adaptive', en: 'Adaptive', zh: '智能' }, { v: 'mcq', en: 'Multiple choice', zh: '选择' },
  { v: 'clue', en: 'Typing', zh: '打字' }, { v: 'build', en: 'Unscramble', zh: '拼字' },
  { v: 'dictation', en: 'Listening', zh: '听写' }, { v: 'reverse', en: 'Recall', zh: '回想' },
  { v: 'match', en: 'Match', zh: '配对' },
];

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
  const param = trackId === 'foundation' ? 'section' : 'pack';
  const a = document.createElement('a'); a.href = `drill.html?${param}=${it.id}`; a.className = 'vcard';
  const badge = it.band || (trackId === 'foundation' ? 'BE' : '');
  a.innerHTML = `<span class="vc-badge">${escapeHtml(badge)}</span>`
    + `<span class="vc-title">${escapeHtml(pick(it.title))}</span>`
    + `<span class="vc-size">${it.size} ${s('words')}${trackId === 'foundation' ? ' · ' + s('section') : ''}</span>`;
  a.addEventListener('click', (e) => { e.preventDefault(); openOptions(it, param); });
  return a;
}

// Pre-session options: order + mode, then launch the drill.
function openOptions(it, param) {
  const lang = getLang();
  const overlay = document.createElement('div'); overlay.className = 'opt-overlay';
  const sheet = document.createElement('div'); sheet.className = 'opt-sheet'; sheet.setAttribute('role', 'dialog');
  let order = 'sequence', mode = 'adaptive';
  const seg = (label, items, cur, onPick) => {
    const wrap = document.createElement('div'); wrap.className = 'opt-row';
    wrap.innerHTML = `<span class="opt-label">${label}</span>`;
    const grp = document.createElement('div'); grp.className = 'opt-seg';
    items.forEach((o) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'opt-btn' + (o.v === cur ? ' on' : ''); b.textContent = o[lang] || o.en;
      b.addEventListener('click', () => { grp.querySelectorAll('.opt-btn').forEach((x) => x.classList.remove('on')); b.classList.add('on'); onPick(o.v); }); grp.append(b); });
    wrap.append(grp); return wrap;
  };
  sheet.innerHTML = `<h3>${escapeHtml(pick(it.title))} <span class="opt-size">${it.size} ${s('words')}</span></h3>`;
  sheet.append(seg(s('order'), ORDERS, order, (v) => order = v));
  sheet.append(seg(s('mode'), MODES, mode, (v) => mode = v));
  const actions = document.createElement('div'); actions.className = 'opt-actions';
  const cancel = document.createElement('button'); cancel.className = 'ghost-btn'; cancel.textContent = s('cancel');
  cancel.addEventListener('click', () => overlay.remove());
  const start = document.createElement('button'); start.className = 'opt-start'; start.textContent = s('start');
  start.addEventListener('click', () => { location.href = `drill.html?${param}=${it.id}&order=${order}&mode=${mode}`; });
  actions.append(cancel, start); sheet.append(actions);
  overlay.append(sheet); overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.append(overlay); start.focus();
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
