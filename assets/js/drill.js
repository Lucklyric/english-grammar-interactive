import { initLang, getLang, toggleLang, otherLang, t, pick } from './i18n.js';
import { store } from './srs.js';
import { wpm, gapFill, gradeTyped, scramble, pickDistractors } from './voclib.mjs';

const $ = (s, r = document) => r.querySelector(s);
const params = new URLSearchParams(location.search);
const ORDER = params.get('order') || 'sequence';        // 'sequence' | 'shuffle'
const FORCED = params.get('mode') || 'adaptive';          // 'adaptive' | mcq|clue|gap|build|dictation|reverse | 'match'

const STR = {
  zh: { clue: '看释义，输入单词', gap: '填入空缺的单词', reverse: '回想词义，然后显示', mcq: '选择正确的词', build: '点字母拼出单词', dictation: '听发音，拼出单词', match: '把单词和释义配对',
    show: '显示', correct: '正确', almost: '差一点（拼写）', wrong: '正确答案：', play: '🔊 播放', clear: '清除', back: '返回词汇',
    sessionDone: '本组完成', score: '正确率', combo: '连击', xp: '经验', empty: '没有可练习的词', skip: '跳过', cont: '继续', best: '最佳连击' },
  en: { clue: 'Type the word for this meaning', gap: 'Type the missing word', reverse: 'Recall the meaning, then reveal', mcq: 'Choose the correct word', build: 'Tap the letters to spell it', dictation: 'Listen, then spell the word', match: 'Match words to meanings',
    show: 'Reveal', correct: 'Correct', almost: 'Almost (spelling)', wrong: 'Answer:', play: '🔊 Play', clear: 'Clear', back: 'Back to vocabulary',
    sessionDone: 'Session complete', score: 'Accuracy', combo: 'Combo', xp: 'XP', empty: 'Nothing to practise', skip: 'Skip', cont: 'Continue', best: 'Best streak' },
};
const s = (k) => (STR[getLang()] || STR.en)[k] || k;

let queue = [], indiv = [], i = 0, results = [], wpms = [], sectionTrick = null;
let curMode = 'clue', combo = 0, xp = 0, bestCombo = 0, startTs = 0;

function speak(text) {
  try { if ('speechSynthesis' in window) { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch {}
}

async function main() {
  initLang(); wireToggle();
  queue = await buildQueue();
  if (ORDER === 'shuffle') shuffle(queue);
  renderTrick();
  if (!queue.length) { $('#drill').innerHTML = `<div class="card"><p>${s('empty')}</p><p><a href="vocab.html">${s('back')}</a></p></div>`; renderHud(); return; }
  document.addEventListener('langchange', () => { renderTrick(); renderHud(); });
  renderHud();
  if (FORCED === 'match') { await runMatchSession(); return finish(); }
  const adaptive = FORCED === 'adaptive';
  // match warm-up only in adaptive mode
  const matchN = adaptive && queue.length >= 6 ? Math.min(8, queue.length) : 0;
  indiv = queue.slice(matchN);
  if (matchN >= 4) await matchRound(queue.slice(0, matchN));
  next();
}

async function runMatchSession() {
  indiv = queue; // for HUD totals
  for (let k = 0; k < queue.length; k += 8) {
    const chunk = queue.slice(k, k + 8);
    if (chunk.length < 2) { chunk.forEach((w) => { store.record(w.w, true); results.push(true); }); break; }
    i = k; renderHud();
    await matchRound(chunk);
  }
}

function resolveForced(m, word) {
  const canGap = !!(word.blank && word.example && word.example.includes(word.blank));
  const canBuild = word.w.length >= 3 && word.w.length <= 14;
  const canMcq = queue.length >= 4;
  if (m === 'gap' && !canGap) return 'clue';
  if (m === 'build' && !canBuild) return 'clue';
  if (m === 'mcq' && !canMcq) return 'clue';
  return m;
}

async function buildQueue() {
  const pack = params.get('pack'), section = params.get('section'), due = params.get('due');
  if (pack) { const P = await fetch(`data/vocab/packs/${pack}.json`).then((r) => r.json()).catch(() => null); return P ? P.words.filter((w) => w.gloss) : []; }
  if (section) { const S = await fetch(`data/vocab/be850/${section}.json`).then((r) => r.json()).catch(() => null); if (S) sectionTrick = S.trick || null; return S ? S.words.filter((w) => w.gloss) : []; }
  if (due) { const all = await fetch('data/vocab/all-words.json').then((r) => r.json()).catch(() => ({})); return store.due(Object.keys(all)).slice(0, 40).map((w) => ({ w, gloss: all[w].g, example: all[w].e, blank: all[w].b, cefr: all[w].c, pos: all[w].p })); }
  return [];
}

/* ---------- HUD ---------- */
function renderHud() {
  let hud = $('#hud');
  if (!hud) { hud = document.createElement('div'); hud.id = 'hud'; hud.className = 'drill-hud'; $('#drill').before(hud); }
  const total = indiv.length || queue.length;
  hud.innerHTML = `<span class="hud-progress">${Math.min(i + 1, total)} / ${total}</span>`
    + `<span class="hud-combo ${combo >= 3 ? 'hot' : ''}">🔥 ${combo}</span>`
    + `<span class="hud-xp">${s('xp')} ${xp}</span>`;
}

/* ---------- Mode selection (SRS-box driven) ---------- */
function modeFor(word) {
  if (FORCED !== 'adaptive' && FORCED !== 'match') return resolveForced(FORCED, word);
  const box = store.get(word.w)?.box || 1;
  const canGap = !!(word.blank && word.example && word.example.includes(word.blank));
  const canMcq = queue.length >= 4;
  const canBuild = word.w.length >= 3 && word.w.length <= 14;
  let pool;
  if (box <= 1) pool = [canMcq ? 'mcq' : 'clue', 'clue'];
  else if (box === 2) pool = [canGap ? 'gap' : 'clue', 'dictation', 'clue'];
  else if (box === 3) pool = [canBuild ? 'build' : 'gap', canGap ? 'gap' : 'dictation', 'dictation'];
  else pool = ['reverse', canBuild ? 'build' : 'dictation', 'dictation'];
  let m = pool[Math.floor(Math.random() * pool.length)];
  if (m === 'gap' && !canGap) m = 'clue';
  if (m === 'mcq' && !canMcq) m = 'clue';
  if (m === 'build' && !canBuild) m = 'reverse';
  return m;
}

/* ---------- Card flow ---------- */
function next() {
  $('#hud') || renderHud();
  if (i >= indiv.length) return finish();
  curMode = modeFor(indiv[i]);
  startTs = Date.now();
  renderHud();
  renderCard();
}

function escapeHtml(x) { return String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

function renderCard() {
  const word = indiv[i]; const mode = curMode; const root = $('#drill'); root.innerHTML = '';
  const card = document.createElement('div'); card.className = `drill-card mode-${mode}`;
  const sub = document.createElement('p'); sub.className = 'drill-sub'; sub.textContent = `${s(mode)} · ${word.cefr || ''}`;
  const feedback = document.createElement('p'); feedback.className = 'drill-feedback'; feedback.setAttribute('aria-live', 'polite');
  card.append(sub);

  if (mode === 'clue' || mode === 'reverse' || mode === 'mcq') { /* handled below */ }

  if (mode === 'mcq') {
    const p = document.createElement('p'); p.className = 'drill-prompt'; p.innerHTML = `<span class="g-en">${escapeHtml(pick(word.gloss))}</span>`; card.append(p);
    const choices = [word, ...pickDistractors(word, queue.filter((x) => x !== word), 3)].map((x) => x.w);
    shuffle(choices);
    const wrap = document.createElement('div'); wrap.className = 'mcq-grid';
    for (const c of choices) {
      const b = document.createElement('button'); b.className = 'mcq-choice'; b.textContent = c;
      b.addEventListener('click', () => {
        const ok = c === word.w; b.classList.add(ok ? 'is-correct' : 'is-wrong');
        if (!ok) [...wrap.children].find((x) => x.textContent === word.w)?.classList.add('is-correct');
        wrap.querySelectorAll('button').forEach((x) => x.disabled = true);
        finishCard(word, ok, feedback, ok ? `✓ ${s('correct')}` : `✗ ${word.w}`);
      });
      wrap.append(b);
    }
    card.append(wrap, feedback); root.append(card); return;
  }

  if (mode === 'reverse') {
    const p = document.createElement('p'); p.className = 'drill-prompt'; p.innerHTML = `<span class="g-word">${escapeHtml(word.w)}</span>`; card.append(p);
    const audio = audioBtn(word.w);
    const btn = document.createElement('button'); btn.className = 'drill-btn'; btn.textContent = s('show');
    btn.addEventListener('click', () => { feedback.innerHTML = `<span class="g-en">${escapeHtml(word.gloss.en)}</span> · <span class="g-zh">${escapeHtml(word.gloss.zh)}</span>`; finishCard(word, true, feedback, '', true); });
    card.append(audio, btn, feedback); root.append(card); setTimeout(() => btn.focus(), 20); return;
  }

  if (mode === 'build') {
    const p = document.createElement('p'); p.className = 'drill-prompt'; p.innerHTML = `<span class="g-en">${escapeHtml(pick(word.gloss))}</span>`; card.append(p);
    const target = word.w; const letters = scramble(target).split('');
    const slot = document.createElement('div'); slot.className = 'build-slot'; slot.textContent = '';
    const tray = document.createElement('div'); tray.className = 'build-tray';
    let built = '';
    const check = () => { if (built.length === target.length) { const ok = built.toLowerCase() === target.toLowerCase(); finishCard(word, ok, feedback, ok ? `✓ ${s('correct')}` : `✗ ${target}`); } };
    letters.forEach((ch, idx) => {
      const tile = document.createElement('button'); tile.className = 'build-tile'; tile.textContent = ch;
      tile.addEventListener('click', () => { if (tile.disabled) return; tile.disabled = true; built += ch; slot.textContent = built; check(); });
      tray.append(tile);
    });
    const clr = document.createElement('button'); clr.className = 'drill-btn ghost'; clr.textContent = s('clear');
    clr.addEventListener('click', () => { built = ''; slot.textContent = ''; tray.querySelectorAll('.build-tile').forEach((x) => x.disabled = false); });
    card.append(slot, tray, clr, feedback); root.append(card); return;
  }

  // input modes: clue, gap, dictation
  let expected = word.w, promptHtml = '';
  if (mode === 'gap') { const g = gapFill(word.example, word.blank); expected = g.answer; promptHtml = `<span class="g-gap">${escapeHtml(g.prompt)}</span><span class="g-zh">${escapeHtml(word.gloss.zh)}</span>`; }
  else if (mode === 'dictation') { promptHtml = `<span class="g-zh hint">${escapeHtml(word.gloss.zh)}</span>`; speak(word.w); }
  else { promptHtml = `<span class="g-en">${escapeHtml(word.gloss.en)}</span><span class="g-zh">${escapeHtml(word.gloss.zh)}</span>${word.pos ? `<span class="g-pos">${word.pos}</span>` : ''}`; }
  const p = document.createElement('p'); p.className = 'drill-prompt'; p.innerHTML = promptHtml; card.append(p);
  if (mode === 'dictation') card.append(audioBtn(word.w));
  const row = document.createElement('div'); row.className = 'drill-row';
  const inp = document.createElement('input'); inp.className = 'drill-input'; inp.type = 'text'; inp.autocapitalize = 'off'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('aria-label', s(mode));
  inp.addEventListener('input', () => { const ok = inp.value && inp.value.trim().toLowerCase() === expected.toLowerCase(); inp.classList.toggle('live-ok', !!ok); });
  const submit = () => {
    if (inp.disabled) return;
    const g = gradeTyped(inp.value, expected);
    const speed = wpm(expected.length, Date.now() - startTs); if (g.correct || g.near) wpms.push(speed);
    inp.disabled = true; inp.classList.toggle('input-ok', g.correct || g.near); inp.classList.toggle('input-bad', !g.correct && !g.near);
    const msg = g.correct ? `✓ ${s('correct')} · ${speed} wpm` : g.near ? `~ ${s('almost')}: <b>${escapeHtml(expected)}</b>` : `✗ ${s('wrong')} <b>${escapeHtml(expected)}</b>`;
    finishCard(word, g.correct || g.near, feedback, msg);
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  const btn = document.createElement('button'); btn.className = 'drill-btn ghost'; btn.textContent = s('skip');
  btn.addEventListener('click', () => { inp.disabled = true; finishCard(word, false, feedback, `${s('wrong')} <b>${escapeHtml(expected)}</b>`); });
  row.append(inp, btn); card.append(row, feedback); root.append(card); setTimeout(() => inp.focus(), 20);
}

function audioBtn(w) { const b = document.createElement('button'); b.className = 'drill-btn ghost audio'; b.type = 'button'; b.textContent = s('play'); b.addEventListener('click', () => speak(w)); return b; }

function finishCard(word, correct, feedback, msg, silent) {
  if (msg) { feedback.innerHTML = msg; feedback.dataset.correct = String(correct); }
  results.push(correct); store.record(word.w, correct);
  if (correct) { combo++; bestCombo = Math.max(bestCombo, combo); const gain = 10 + Math.min(combo, 10) * 2; xp += gain; store.addXp(gain, combo); } else combo = 0;
  renderHud();
  if (correct) { setTimeout(() => { i++; next(); }, silent ? 250 : 850); }
  else showContinue();
}

function showContinue() {
  const root = $('#drill');
  if (root.querySelector('.drill-next')) return;
  const nb = document.createElement('button'); nb.className = 'drill-next'; nb.textContent = (i + 1 >= indiv.length) ? s('sessionDone') : s('cont');
  nb.addEventListener('click', () => { i++; next(); });
  root.append(nb); setTimeout(() => nb.focus(), 20);
}

/* ---------- Match round ---------- */
function matchRound(words) {
  return new Promise((resolve) => {
    const root = $('#drill'); root.innerHTML = '';
    const head = document.createElement('p'); head.className = 'drill-sub'; head.textContent = s('match'); root.append(head);
    const grid = document.createElement('div'); grid.className = 'match-grid';
    const left = document.createElement('div'); left.className = 'match-col';
    const right = document.createElement('div'); right.className = 'match-col';
    const metas = words.map((w) => pick(w.gloss)); const rights = words.map((w, idx) => ({ idx, meta: metas[idx] })); shuffle(rights);
    let selWord = null, selMeta = null, matched = 0;
    const tryMatch = () => {
      if (selWord == null || selMeta == null) return;
      const ok = selWord.dataset.idx === selMeta.dataset.idx;
      if (ok) { selWord.classList.add('matched'); selMeta.classList.add('matched'); selWord.disabled = selMeta.disabled = true; store.record(words[+selWord.dataset.idx].w, true); results.push(true); xp += 8; store.addXp(8, combo); matched++; renderHud();
        selWord = selMeta = null; if (matched === words.length) setTimeout(resolve, 350); }
      else { const a = selWord, b = selMeta; a.classList.add('miss'); b.classList.add('miss'); combo = 0; renderHud(); setTimeout(() => { a.classList.remove('miss', 'sel'); b.classList.remove('miss', 'sel'); }, 450); selWord = selMeta = null; }
    };
    words.forEach((w, idx) => { const b = document.createElement('button'); b.className = 'match-item'; b.textContent = w.w; b.dataset.idx = idx;
      b.addEventListener('click', () => { if (b.disabled) return; left.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); selWord = b; tryMatch(); }); left.append(b); });
    rights.forEach((r) => { const b = document.createElement('button'); b.className = 'match-item meta'; b.textContent = r.meta; b.dataset.idx = r.idx;
      b.addEventListener('click', () => { if (b.disabled) return; right.querySelectorAll('.sel').forEach((x) => x.classList.remove('sel')); b.classList.add('sel'); selMeta = b; tryMatch(); }); right.append(b); });
    grid.append(left, right); root.append(grid); renderHud();
  });
}

/* ---------- Results ---------- */
function finish() {
  const acc = results.length ? Math.round(results.filter(Boolean).length / results.length * 100) : 100;
  const avgWpm = wpms.length ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length) : 0;
  // XP/bestCombo already persisted incrementally via store.addXp during the session.
  $('#drill').innerHTML = `<div class="card drill-summary"><h2>🎉 ${s('sessionDone')}</h2>`
    + `<div class="result-stats"><div><span class="rs-num">${acc}%</span><span class="rs-lab">${s('score')}</span></div>`
    + `<div><span class="rs-num">+${xp}</span><span class="rs-lab">${s('xp')}</span></div>`
    + `<div><span class="rs-num">${bestCombo}</span><span class="rs-lab">${s('best')}</span></div>`
    + (avgWpm ? `<div><span class="rs-num">${avgWpm}</span><span class="rs-lab">wpm</span></div>` : '')
    + `</div><p><a class="drill-btn-link" href="vocab.html">${s('back')}</a></p></div>`;
  const hud = $('#hud'); if (hud) hud.remove();
}

function shuffle(a) { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; }

function renderTrick() {
  const el = $('#trickcard'); if (!el) return;
  if (!sectionTrick) { el.innerHTML = ''; return; }
  const tk = sectionTrick;
  el.innerHTML = `<details class="trick" open><summary>${escapeHtml(pick(tk.heading))}</summary><p>${escapeHtml(pick(tk.body))}</p>`
    + (tk.examples || []).map((e) => `<p class="trick-ex"><code>${escapeHtml(e.text)}</code>${e.note ? ` — ${escapeHtml(pick(e.note))}` : ''}</p>`).join('') + `</details>`;
}

function wireToggle() { const b = $('#lang-toggle'); if (b) { b.addEventListener('click', () => toggleLang()); sync(); } document.addEventListener('langchange', sync); }
function sync() { const b = $('#lang-toggle'); if (b) b.textContent = otherLang() === 'zh' ? '中文' : 'EN'; }

main();
