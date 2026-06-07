import { initLang, getLang, toggleLang, otherLang, pick } from './i18n.js';
import { wpm } from './voclib.mjs';
import { estore } from './eea-store.js';

const $ = (s, r = document) => r.querySelector(s);
const params = new URLSearchParams(location.search);
const UID = params.get('unit');                       // composite SId-Uid, e.g. "s1-01"
const MODE = params.get('mode') || 'en';              // 'en' | 'zh' | 'type'
const ORDER = params.get('order') || 'sequence';      // 'sequence' | 'shuffle'

const STR = {
  zh: { en: '看英文，回想中文', zh: '看中文，回想英文', type: '看中文，输入英文', reveal: '显示', play: '🔊 播放', next: '下一句', back: '返回',
    correct: '正确', answer: '答案：', done: '完成', acc: '正确率', reviewed: '已浏览', avgwpm: '平均速度', empty: '没有可练习的句子',
    retry: '重来', skip: '跳过', hintTab: '按住 Tab 偷看答案' },
  en: { en: 'Read EN, recall the meaning', zh: 'Read 中文, recall the English', type: 'Read 中文, type the English', reveal: 'Reveal', play: '🔊 Play', next: 'Next', back: 'Back',
    correct: 'Correct', answer: 'Answer:', done: 'Done', acc: 'Accuracy', reviewed: 'reviewed', avgwpm: 'avg wpm', empty: 'Nothing to practise',
    retry: 'restart', skip: 'Skip', hintTab: 'Hold Tab to peek the answer' },
};
const s = (k) => (STR[getLang()] || STR.en)[k] || k;

let unit = null, list = [], i = 0, results = [], wpms = [], startTs = 0;

function speak(text) {
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
    const hint = document.createElement('p'); hint.className = 'eea-hint'; hint.textContent = s('hintTab');

    let firstTs = 0, restarts = 0, done = false, peeking = false;
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
      const typed = inp.value.toLowerCase();
      if (!typed) { inp.classList.remove('input-bad'); feedback.textContent = ''; return; }
      if (!firstTs) firstTs = Date.now();
      if (typed === target) return finishOk();
      if (typed === target.slice(0, typed.length)) { inp.classList.remove('input-bad'); feedback.textContent = ''; return; }
      // A wrong character: flash, then clear to restart the whole phrase.
      restarts++;
      inp.classList.add('input-bad');
      feedback.innerHTML = `✗ ${s('retry')}`; feedback.dataset.correct = 'false';
      setTimeout(() => { if (done || !inp.isConnected) return; inp.value = ''; inp.classList.remove('input-bad'); inp.focus(); }, 200);
    });
    // Hold Tab to peek the answer; release to hide it.
    inp.addEventListener('keydown', (e) => { if (e.key === 'Tab') { e.preventDefault(); if (!peeking) { peeking = true; peek.classList.add('show'); } } });
    inp.addEventListener('keyup', (e) => { if (e.key === 'Tab') { peeking = false; peek.classList.remove('show'); } });
    inp.addEventListener('blur', () => { peeking = false; peek.classList.remove('show'); });

    const skip = document.createElement('button'); skip.className = 'drill-btn ghost'; skip.type = 'button'; skip.textContent = s('skip');
    skip.addEventListener('click', () => {
      if (done) return; done = true; inp.disabled = true; results.push(false);
      feedback.innerHTML = `✗ ${s('answer')} <b>${escapeHtml(p.en)}</b>`; feedback.dataset.correct = 'false';
      speak(p.en); showNext();
    });

    card.append(stage, peek, hint, skip, feedback); root.append(card);
    setTimeout(() => inp.focus(), 20); return;
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

function wireToggle() { const b = $('#lang-toggle'); if (b) { b.addEventListener('click', () => toggleLang()); sync(); } document.addEventListener('langchange', sync); }
function sync() { const b = $('#lang-toggle'); if (b) b.textContent = otherLang() === 'zh' ? '中文' : 'EN'; }

main();
