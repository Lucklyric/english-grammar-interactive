import { initLang, getLang, toggleLang, otherLang, t, pick } from './i18n.js';
import { store } from './srs.js';
import { answerCorrect, wpm, gapFill } from './voclib.mjs';

const $ = (s, r = document) => r.querySelector(s);
const params = new URLSearchParams(location.search);

const STR = {
  zh: { clue: '看释义，输入单词', gap: '填入空缺的单词', reverse: '这个词的意思？回想后显示', show: '显示', correct: '正确', wrong: '正确答案：', next: '下一个', done: '完成！', back: '返回词汇', sessionDone: '本组完成', score: '正确率', speed: '速度', empty: '没有可练习的词', skip: '跳过', enter: '回车提交' },
  en: { clue: 'Type the word for this meaning', gap: 'Type the missing word', reverse: "Recall the meaning, then reveal", show: 'Reveal', correct: 'Correct', wrong: 'Answer:', next: 'Next', done: 'Done!', back: 'Back to vocabulary', sessionDone: 'Session complete', score: 'Accuracy', speed: 'Speed', empty: 'Nothing to practise', skip: 'Skip', enter: 'Enter to submit' },
};
const s = (k) => (STR[getLang()] || STR.en)[k] || k;

let queue = [], i = 0, results = [], startTs = 0, sectionTrick = null, curMode = 'clue';

async function main() {
  initLang(); wireToggle();
  queue = await buildQueue();
  renderTrick();
  if (!queue.length) { $('#drill').innerHTML = `<div class="card"><p>${s('empty')}</p><p><a href="vocab.html">${s('back')}</a></p></div>`; return; }
  document.addEventListener('langchange', () => { renderTrick(); if (i < queue.length) renderCard(); });
  next();
}

function renderTrick() {
  const el = $('#trickcard'); if (!el) return;
  if (!sectionTrick) { el.innerHTML = ''; return; }
  const tk = sectionTrick;
  el.innerHTML = `<details class="trick" open><summary>${escapeHtml(pick(tk.heading))}</summary>`
    + `<p>${escapeHtml(pick(tk.body))}</p>`
    + (tk.examples || []).map((e) => `<p class="trick-ex"><code>${escapeHtml(e.text)}</code>${e.note ? ` — ${escapeHtml(pick(e.note))}` : ''}</p>`).join('')
    + `</details>`;
}

async function buildQueue() {
  const pack = params.get('pack'), section = params.get('section'), due = params.get('due');
  if (pack) { const P = await fetch(`data/vocab/packs/${pack}.json`).then((r) => r.json()).catch(() => null); return P ? P.words.filter((w) => w.gloss) : []; }
  if (section) { const S = await fetch(`data/vocab/be850/${section}.json`).then((r) => r.json()).catch(() => null); if (S) sectionTrick = S.trick || null; return S ? S.words.filter((w) => w.gloss) : []; }
  if (due) {
    const all = await fetch('data/vocab/all-words.json').then((r) => r.json()).catch(() => ({}));
    const dueWords = store.due(Object.keys(all));
    return dueWords.map((w) => ({ w, gloss: all[w].g, example: all[w].e, blank: all[w].b, cefr: all[w].c, pos: all[w].p }));
  }
  return [];
}

// Mode escalates with mastery (Leitner box): recognition -> context -> production.
// new/box1 -> clue, box2-3 -> gap-fill, box4-5 -> reverse, with a light random tiebreaker.
function modeFor(word) {
  const box = store.get(word.w)?.box || 1;
  const canGap = !!(word.blank && word.example && word.example.includes(word.blank));
  let mode = box <= 1 ? 'clue' : box <= 3 ? 'gap' : 'reverse';
  if (Math.random() < 0.25) { // vary so repeat drills aren't identical
    const pool = ['clue', canGap ? 'gap' : 'reverse', 'reverse'];
    mode = pool[Math.floor(Math.random() * pool.length)];
  }
  if (mode === 'gap' && !canGap) mode = box >= 3 ? 'reverse' : 'clue';
  return mode;
}

function next() {
  if (i >= queue.length) return finish();
  curMode = modeFor(queue[i]); // compute once per card so re-renders (e.g. lang toggle) keep the same mode
  startTs = Date.now();
  renderCard();
}

function renderCard() {
  const word = queue[i]; const mode = curMode;
  const root = $('#drill'); root.innerHTML = '';
  const head = document.createElement('div'); head.className = 'drill-head';
  head.innerHTML = `<span class="drill-progress">${i + 1} / ${queue.length}</span><span class="drill-band">${word.cefr || ''}</span>`;
  root.append(head);

  const card = document.createElement('div'); card.className = 'drill-card';
  const promptEl = document.createElement('p'); promptEl.className = 'drill-prompt';
  const sub = document.createElement('p'); sub.className = 'drill-sub'; sub.textContent = s(mode);
  const feedback = document.createElement('p'); feedback.className = 'drill-feedback'; feedback.setAttribute('aria-live', 'polite');

  let expected = word.w;
  if (mode === 'clue') {
    promptEl.innerHTML = `<span class="g-en">${escapeHtml(word.gloss.en)}</span><span class="g-zh">${escapeHtml(word.gloss.zh)}</span>${word.pos ? `<span class="g-pos">${word.pos}</span>` : ''}`;
  } else if (mode === 'gap') {
    const g = gapFill(word.example, word.blank); expected = g.answer;
    promptEl.innerHTML = `<span class="g-gap">${escapeHtml(g.prompt)}</span><span class="g-zh">${escapeHtml(word.gloss.zh)}</span>`;
  } else { // reverse
    promptEl.innerHTML = `<span class="g-word">${escapeHtml(word.w)}</span>`;
  }
  card.append(sub, promptEl);

  if (mode === 'reverse') {
    const btn = document.createElement('button'); btn.className = 'drill-btn'; btn.textContent = s('show');
    btn.addEventListener('click', () => { feedback.innerHTML = `<span class="g-en">${escapeHtml(word.gloss.en)}</span> · <span class="g-zh">${escapeHtml(word.gloss.zh)}</span>`; grade(word, true); showNext(); });
    card.append(btn);
  } else {
    const inp = document.createElement('input'); inp.className = 'drill-input'; inp.type = 'text'; inp.autocapitalize = 'off'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', s(mode));
    const submit = () => {
      const correct = answerCorrect(inp.value, expected);
      const speed = wpm(expected.length, Date.now() - startTs);
      feedback.dataset.correct = String(correct);
      feedback.innerHTML = correct ? `✓ ${s('correct')} · ${speed} wpm` : `✗ ${s('wrong')} <b>${escapeHtml(expected)}</b>`;
      grade(word, correct); inp.disabled = true; showNext();
    };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !inp.disabled) submit(); });
    const row = document.createElement('div'); row.className = 'drill-row';
    const btn = document.createElement('button'); btn.className = 'drill-btn'; btn.textContent = s('skip');
    btn.addEventListener('click', () => { feedback.innerHTML = `${s('wrong')} <b>${escapeHtml(expected)}</b>`; grade(word, false); showNext(); });
    row.append(inp, btn); card.append(row);
    setTimeout(() => inp.focus(), 20);
  }
  card.append(feedback);
  root.append(card);
}

function grade(word, correct) { results.push(correct); store.record(word.w, correct); }
function showNext() {
  const root = $('#drill');
  if (root.querySelector('.drill-next')) return; // guard against double-call
  const nb = document.createElement('button'); nb.className = 'drill-next'; nb.textContent = (i + 1 >= queue.length) ? s('done') : s('next');
  nb.addEventListener('click', () => { i++; next(); });
  root.append(nb);
  // A focused button activates on Enter natively — no leaking document listener needed.
  setTimeout(() => nb.focus(), 20);
}

function finish() {
  const acc = results.length ? Math.round(results.filter(Boolean).length / results.length * 100) : 0;
  $('#drill').innerHTML = `<div class="card drill-summary"><h2>${s('sessionDone')}</h2><p class="big-score">${s('score')}: ${acc}%</p><p>${results.length} words</p><p><a class="drill-btn-link" href="vocab.html">${s('back')}</a></p></div>`;
}

function wireToggle() { const b = $('#lang-toggle'); if (b) { b.addEventListener('click', () => toggleLang()); sync(); } document.addEventListener('langchange', sync); }
function sync() { const b = $('#lang-toggle'); if (b) b.textContent = otherLang() === 'zh' ? '中文' : 'EN'; }
function escapeHtml(x) { return String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

main();
