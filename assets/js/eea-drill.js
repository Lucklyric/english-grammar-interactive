import { initLang, getLang, toggleLang, otherLang, pick } from './i18n.js';
import { wpm } from './voclib.mjs';
import { estore, prefs } from './eea-store.js';
import { sound } from './sound.js';

const $ = (s, r = document) => r.querySelector(s);
const params = new URLSearchParams(location.search);
const UID = params.get('unit');                       // composite SId-Uid, e.g. "s1-01"
const MODE = params.get('mode') || 'en';              // 'en' | 'zh' | 'type'
const ORDER = params.get('order') || 'sequence';      // 'sequence' | 'shuffle'

const STR = {
  zh: { en: '看英文，回想中文', zh: '看中文，回想英文', type: '看中文，输入英文', reveal: '显示', play: '🔊 播放', next: '下一句', back: '返回',
    correct: '正确', answer: '答案：', done: '完成', acc: '正确率', reviewed: '已浏览', avgwpm: '平均速度', empty: '没有可练习的句子',
    retry: '重来', skip: '跳过', peek: '偷看', hintPeek: '按住“偷看”查看答案（电脑可用 Tab）' },
  en: { en: 'Read EN, recall the meaning', zh: 'Read 中文, recall the English', type: 'Read 中文, type the English', reveal: 'Reveal', play: '🔊 Play', next: 'Next', back: 'Back',
    correct: 'Correct', answer: 'Answer:', done: 'Done', acc: 'Accuracy', reviewed: 'reviewed', avgwpm: 'avg wpm', empty: 'Nothing to practise',
    retry: 'restart', skip: 'Skip', peek: 'Peek', hintPeek: 'Hold “Peek” to see the answer (or Tab on desktop)' },
};
const s = (k) => (STR[getLang()] || STR.en)[k] || k;

let unit = null, list = [], i = 0, results = [], wpms = [], startTs = 0;
let PREF = prefs.get();   // { typeSound, reading } — updated live by the topbar toggles

function speak(text) {
  if (!PREF.reading) return;
  try { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch {}
}
function escapeHtml(x) { return String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function shuffle(a) { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; }

// Strict typing target: lowercase; keep letters/digits/apostrophes; everything else
// (punctuation, dashes, colons) collapses to a single space. The learner types words +
// spaces only — no punctuation or capitalization needed.
function typingTarget(x) {
  return String(x).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Focus the typing input. iOS blocks the soft keyboard on programmatic focus outside a
// user gesture, so we also raise it on the first tap anywhere on the page.
let raiseKbd = null;
function focusType(inp) {
  try { inp.focus({ preventScroll: true }); } catch { try { inp.focus(); } catch {} }
  setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch {} }, 60);
  if (raiseKbd) { document.removeEventListener('pointerdown', raiseKbd); document.removeEventListener('touchend', raiseKbd); }
  raiseKbd = () => { if (inp.isConnected && !inp.disabled) { try { inp.focus(); } catch {} } };
  document.addEventListener('pointerdown', raiseKbd, { once: true });
  document.addEventListener('touchend', raiseKbd, { once: true });
}

async function main() {
  initLang(); wireToggle();
  unit = await fetch(`data/eea/units/${UID}.json`).then((r) => r.json()).catch(() => null);
  list = unit && Array.isArray(unit.phrases) ? unit.phrases.filter((p) => p && p.en) : [];
  if (ORDER === 'shuffle') shuffle(list);
  if (!list.length) { $('#drill').innerHTML = `<div class="card"><p>${s('empty')}</p><p><a href="eea.html">${s('back')}</a></p></div>`; return; }
  document.addEventListener('langchange', () => { if (i < list.length) renderCard(); });
  next();
}

function renderHud() {
  let hud = $('#hud');
  if (!hud) { hud = document.createElement('div'); hud.id = 'hud'; hud.className = 'drill-hud'; $('#drill').before(hud); }
  hud.innerHTML = `<span class="hud-progress">${Math.min(i + 1, list.length)} / ${list.length}</span>`
    + `<span class="hud-xp">${escapeHtml(pick(unit.title))}</span>`;
}

function next() {
  if (i >= list.length) return finish();
  startTs = Date.now();
  renderHud(); renderCard();
}

function renderCard() {
  const p = list[i]; const root = $('#drill'); root.innerHTML = '';
  const card = document.createElement('div'); card.className = `drill-card mode-${MODE}`;
  const sub = document.createElement('p'); sub.className = 'drill-sub'; sub.textContent = `${s(MODE)}${unit.tense ? ' · ' + unit.tense : ''}`;
  card.append(sub);
  const feedback = document.createElement('p'); feedback.className = 'drill-feedback'; feedback.setAttribute('aria-live', 'polite');

  if (MODE === 'type') {
    const target = typingTarget(p.en);
    const prompt = document.createElement('p'); prompt.className = 'drill-prompt';
    prompt.innerHTML = `<span class="g-zh big">${escapeHtml(p.zh)}</span>`; card.append(prompt);

    const stage = document.createElement('div'); stage.className = 'eea-typestage';
    const inp = document.createElement('input'); inp.className = 'drill-input eea-type'; inp.type = 'text';
    inp.autocapitalize = 'off'; inp.autocomplete = 'off'; inp.autocorrect = 'off'; inp.spellcheck = false;
    inp.setAttribute('aria-label', s('type'));
    stage.append(inp);

    // Hold-Tab peek overlay + hint line.
    const peek = document.createElement('div'); peek.className = 'eea-peek'; peek.textContent = p.en;
    const hint = document.createElement('p'); hint.className = 'eea-hint'; hint.textContent = s('hintPeek');
    const showPeek = () => peek.classList.add('show');
    const hidePeek = () => peek.classList.remove('show');

    let firstTs = 0, restarts = 0, done = false, peeking = false, prevLen = 0;
    const finishOk = () => {
      done = true; inp.disabled = true; inp.classList.add('input-ok');
      const speed = Math.min(200, wpm(target.length, Date.now() - (firstTs || startTs)));   // cap guards paste/near-zero elapsed
      wpms.push(speed); results.push(true);
      feedback.innerHTML = `✓ ${s('correct')} · ${speed} wpm${restarts ? ` · ${restarts}× ${s('retry')}` : ''}`;
      feedback.dataset.correct = 'true'; speak(p.en);
      setTimeout(() => { i++; next(); }, 900);   // correct → auto-advance, no button to press
    };
    inp.addEventListener('input', () => {
      if (done) return;
      const grew = inp.value.length > prevLen; prevLen = inp.value.length;
      const typed = typingTarget(inp.value);   // normalize same as target → punctuation (",", ".", etc.) is optional, never an error
      if (!typed) { inp.classList.remove('input-bad'); feedback.textContent = ''; return; }
      if (!firstTs) firstTs = Date.now();
      if (typed === target) { if (PREF.typeSound) sound.success(); return finishOk(); }
      if (typed === target.slice(0, typed.length)) { if (grew && PREF.typeSound) sound.key(); inp.classList.remove('input-bad'); feedback.textContent = ''; return; }
      // A wrong character: buzz, flash, then clear to restart the whole phrase.
      restarts++;
      if (PREF.typeSound) sound.error();
      inp.classList.add('input-bad');
      feedback.innerHTML = `✗ ${s('retry')}`; feedback.dataset.correct = 'false';
      setTimeout(() => { if (done || !inp.isConnected) return; inp.value = ''; prevLen = 0; inp.classList.remove('input-bad'); inp.focus(); }, 200);
    });
    // Peek: hold Tab (desktop) or hold the 👁 button (touch). preventDefault on
    // pointerdown keeps focus on the input so the mobile keyboard doesn't drop.
    inp.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); if (!peeking) { peeking = true; showPeek(); } } });
    inp.addEventListener('keyup', (e) => { if (e.key === 'Tab') { peeking = false; hidePeek(); } });
    inp.addEventListener('blur', () => { peeking = false; hidePeek(); });

    const peekBtn = document.createElement('button'); peekBtn.className = 'drill-btn ghost eea-peekbtn'; peekBtn.type = 'button'; peekBtn.textContent = `👁 ${s('peek')}`;
    peekBtn.addEventListener('pointerdown', showPeek);
    peekBtn.addEventListener('mousedown', (e) => e.preventDefault());                                  // keep input focus (desktop)
    peekBtn.addEventListener('touchstart', (e) => { e.preventDefault(); showPeek(); }, { passive: false }); // keep focus + no scroll (mobile)
    ['pointerup', 'pointerleave', 'pointercancel', 'touchend', 'touchcancel'].forEach((ev) => peekBtn.addEventListener(ev, hidePeek));
    peekBtn.addEventListener('contextmenu', (e) => e.preventDefault());

    const skip = document.createElement('button'); skip.className = 'drill-btn ghost'; skip.type = 'button'; skip.textContent = s('skip');
    skip.addEventListener('click', () => {
      if (done) return; done = true; inp.disabled = true; results.push(false);
      feedback.innerHTML = `✗ ${s('answer')} <b>${escapeHtml(p.en)}</b>`; feedback.dataset.correct = 'false';
      speak(p.en); showNext();
    });

    const controls = document.createElement('div'); controls.className = 'eea-controls';
    controls.append(peekBtn, skip);
    // peek sits BELOW the controls so revealing it never reflows the buttons (which would
    // slide them out from under a held finger/cursor and cancel the press).
    card.append(stage, hint, controls, peek, feedback); root.append(card);
    focusType(inp); return;
  }

  // Flashcard modes: 'en' (English lead) / 'zh' (Chinese lead)
  const lead = MODE === 'en' ? p.en : p.zh;
  const back = MODE === 'en' ? p.zh : p.en;
  const prompt = document.createElement('p'); prompt.className = 'drill-prompt';
  prompt.innerHTML = `<span class="${MODE === 'en' ? 'g-en big' : 'g-zh big'}">${escapeHtml(lead)}</span>`;
  card.append(prompt);
  card.append(audioBtn(p.en));
  const revealWrap = document.createElement('div'); revealWrap.className = 'eea-reveal';
  const revealBtn = document.createElement('button'); revealBtn.className = 'drill-btn ghost'; revealBtn.textContent = s('reveal');
  revealBtn.addEventListener('click', () => {
    revealWrap.innerHTML = `<span class="${MODE === 'en' ? 'g-zh' : 'g-en'} revealed">${escapeHtml(back)}</span>`;
    showNext(true);
  });
  revealWrap.append(revealBtn);
  card.append(revealWrap, feedback); root.append(card);
  setTimeout(() => revealBtn.focus(), 20);
}

function audioBtn(w) { const b = document.createElement('button'); b.className = 'drill-btn ghost audio'; b.type = 'button'; b.textContent = s('play'); b.addEventListener('click', () => speak(w)); return b; }

function showNext(markReviewed) {
  const root = $('#drill');
  if (root.querySelector('.drill-next')) return;   // already shown — never double-count
  if (markReviewed) results.push(true);
  const nb = document.createElement('button'); nb.className = 'drill-next';
  nb.textContent = (i + 1 >= list.length) ? s('done') : s('next');
  nb.addEventListener('click', () => { i++; next(); });
  root.append(nb); setTimeout(() => nb.focus(), 20);
}

function finish() {
  const total = results.length;
  const acc = total ? Math.round(results.filter(Boolean).length / total * 100) : 100;
  const avg = wpms.length ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length) : 0;
  estore.record(UID, MODE === 'type' ? { acc, wpm: avg } : {});
  const stats = MODE === 'type'
    ? `<div><span class="rs-num">${acc}%</span><span class="rs-lab">${s('acc')}</span></div>`
      + (avg ? `<div><span class="rs-num">${avg}</span><span class="rs-lab">${s('avgwpm')}</span></div>` : '')
    : `<div><span class="rs-num">${list.length}</span><span class="rs-lab">${s('reviewed')}</span></div>`;
  $('#drill').innerHTML = `<div class="card drill-summary"><h2>🎉 ${s('done')}</h2><div class="result-stats">${stats}</div>`
    + `<p><a class="drill-btn-link" href="eea.html">${s('back')}</a></p></div>`;
  const hud = $('#hud'); if (hud) hud.remove();
}

function wireToggle() {
  const b = $('#lang-toggle'); if (b) { b.addEventListener('click', () => toggleLang()); sync(); } document.addEventListener('langchange', sync);
  wireSnd('#snd-key', 'typeSound'); wireSnd('#snd-read', 'reading');
}
function wireSnd(sel, key) {
  const btn = $(sel); if (!btn) return;
  const paint = () => { btn.classList.toggle('off', !PREF[key]); btn.setAttribute('aria-pressed', String(!!PREF[key])); };
  paint();
  btn.addEventListener('click', () => { PREF = prefs.set(key, !PREF[key]); paint(); if (key === 'typeSound' && PREF.typeSound) sound.key(); });
}
function sync() { const b = $('#lang-toggle'); if (b) b.textContent = otherLang() === 'zh' ? '中文' : 'EN'; }

main();
