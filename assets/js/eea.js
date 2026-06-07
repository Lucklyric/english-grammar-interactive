import { initLang, getLang, toggleLang, otherLang, pick } from './i18n.js';
import { estore } from './eea-store.js';

const $ = (s, r = document) => r.querySelector(s);
const STR = {
  zh: { title: '日常英语', tagline: '《英语日常活动》改编 · 按主题与单元练习地道短句', phrases: '句', done: '已练', reset: '重置进度',
    mode: '模式', order: '顺序', start: '开始', cancel: '取消', custom: '自编' },
  en: { title: 'Everyday English', tagline: 'Adapted from English For Everyday Activities · practise real phrases by topic & unit', phrases: 'phrases', done: 'practised', reset: 'Reset progress',
    mode: 'Mode', order: 'Order', start: 'Start', cancel: 'Cancel', custom: 'Custom' },
};
const s = (k) => (STR[getLang()] || STR.en)[k] || k;

const MODES = [
  { v: 'en', en: 'English', zh: '英文' },
  { v: 'zh', en: '中文', zh: '中文' },
  { v: 'type', en: 'Type ⌨', zh: '打字 ⌨' },
];
const ORDERS = [{ v: 'sequence', en: 'Sequence', zh: '顺序' }, { v: 'shuffle', en: 'Shuffle', zh: '随机' }];

let INDEX = { sections: [] };

async function main() {
  initLang(); wireChrome();
  INDEX = await fetch('data/eea/index.json').then((r) => r.json()).catch(() => ({ sections: [] }));
  document.addEventListener('langchange', render);
  render();
}

function render() {
  sync();
  $('#etitle').textContent = s('title');
  $('#etagline').textContent = s('tagline');
  $('#reset').textContent = s('reset');

  const total = INDEX.sections.reduce((n, sec) => n + sec.units.length, 0);
  const done = estore.practicedCount();
  $('#progress-strip').textContent = `${done} / ${total} ${s('done')}`;
  $('#progress-bar').style.width = total ? `${(done / total) * 100}%` : '0%';

  const root = $('#sections'); root.innerHTML = '';
  for (const sec of INDEX.sections) {
    const el = document.createElement('section'); el.className = 'vtrack';
    el.innerHTML = `<h2>${escapeHtml(pick(sec.title))} <span class="count">${sec.units.length}</span></h2>`;
    const grid = document.createElement('div'); grid.className = 'vgrid';
    for (const u of sec.units) grid.append(card(u, sec.id));
    el.append(grid); root.append(el);
  }
}

function card(u, sectionId) {
  const a = document.createElement('a'); a.href = `eea-drill.html?unit=${u.uid}`; a.className = 'vcard';
  if (estore.get(u.uid).practiced) a.classList.add('is-practised');
  const badge = u.custom ? s('custom') : `#${String(u.u).replace(/^0+/, '') || u.u}`;
  a.innerHTML = `<span class="vc-badge">${escapeHtml(badge)} · L${u.level || 1}</span>`
    + `<span class="vc-title">${escapeHtml(pick(u.title))}</span>`
    + `<span class="vc-size">${u.size} ${s('phrases')}${estore.get(u.uid).practiced ? ' · ✓' : ''}</span>`;
  a.addEventListener('click', (e) => { e.preventDefault(); openOptions(u); });
  return a;
}

// Pre-session sheet: choose study mode + order, then launch.
function openOptions(u) {
  const lang = getLang();
  let mode = 'en', order = 'sequence';
  const overlay = document.createElement('div'); overlay.className = 'opt-overlay';
  const sheet = document.createElement('div'); sheet.className = 'opt-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
  const seg = (label, items, cur, onPick) => {
    const wrap = document.createElement('div'); wrap.className = 'opt-row';
    wrap.innerHTML = `<span class="opt-label">${label}</span>`;
    const grp = document.createElement('div'); grp.className = 'opt-seg';
    items.forEach((o) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'opt-btn' + (o.v === cur ? ' on' : ''); b.textContent = o[lang] || o.en;
      b.addEventListener('click', () => { grp.querySelectorAll('.opt-btn').forEach((x) => x.classList.remove('on')); b.classList.add('on'); onPick(o.v); });
      grp.append(b);
    });
    wrap.append(grp); return wrap;
  };
  sheet.innerHTML = `<h3>${escapeHtml(pick(u.title))} <span class="opt-size">${u.size} ${s('phrases')}</span></h3>`;
  sheet.append(seg(s('mode'), MODES, mode, (v) => mode = v));
  sheet.append(seg(s('order'), ORDERS, order, (v) => order = v));
  const actions = document.createElement('div'); actions.className = 'opt-actions';
  const cancel = document.createElement('button'); cancel.className = 'ghost-btn'; cancel.textContent = s('cancel');
  cancel.addEventListener('click', () => overlay.remove());
  const start = document.createElement('button'); start.className = 'opt-start'; start.textContent = s('start');
  start.addEventListener('click', () => { location.href = `eea-drill.html?unit=${u.uid}&mode=${mode}&order=${order}`; });
  actions.append(cancel, start); sheet.append(actions);
  overlay.append(sheet); overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); } });
  document.body.append(overlay); start.focus();
}

function wireChrome() {
  $('#lang-toggle').addEventListener('click', () => toggleLang());
  $('#reset').addEventListener('click', () => { if (confirm(s('reset') + '?')) { localStorage.removeItem('egi:v1:eea'); render(); } });
  sync();
}
function sync() { const b = $('#lang-toggle'); if (b) b.textContent = otherLang() === 'zh' ? '中文' : 'EN'; }
function escapeHtml(x) { return String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

main();
