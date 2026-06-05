import { pick, t } from './i18n.js';
import { fillCorrect } from './quizlib.mjs';

// Render one quiz (mcq/fill/error) into a section element. Calls onResult(qid, correct).
export function renderQuiz(q, onResult) {
  const wrap = document.createElement('section');
  wrap.className = `quiz quiz-${q.type}`;
  const live = document.createElement('p');
  live.className = 'quiz-feedback';
  live.setAttribute('aria-live', 'polite');

  if (q.type === 'mcq') {
    const p = document.createElement('p'); p.className = 'quiz-prompt'; p.textContent = pick(q.prompt); wrap.append(p);
    const fs = document.createElement('fieldset');
    for (const c of q.choices) {
      const id = `${q.id}-${c.id}`;
      const lab = document.createElement('label'); lab.htmlFor = id; lab.className = 'choice';
      const inp = document.createElement('input'); inp.type = 'radio'; inp.name = q.id; inp.id = id; inp.value = c.id;
      inp.addEventListener('change', () => {
        const correct = c.id === q.answer;
        live.textContent = (correct ? '✓ ' : '✗ ') + pick(q.explain);
        live.dataset.correct = String(correct);
        wrap.querySelectorAll('.choice').forEach((l) => l.classList.remove('is-correct', 'is-wrong'));
        lab.classList.add(correct ? 'is-correct' : 'is-wrong');
        onResult?.(q.id, correct);
      });
      lab.append(inp, document.createTextNode(' ' + pick(c.text)));
      fs.append(lab);
    }
    wrap.append(fs);
  } else if (q.type === 'fill') {
    const p = document.createElement('p'); p.className = 'quiz-prompt'; p.textContent = pick(q.prompt); wrap.append(p);
    const row = document.createElement('div'); row.className = 'quiz-row';
    const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'quiz-fill-input'; inp.setAttribute('aria-label', pick(q.prompt));
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = t('check');
    const submit = () => {
      const correct = fillCorrect(inp.value, q.answers);
      live.textContent = (correct ? '✓ ' : '✗ ') + pick(q.explain);
      live.dataset.correct = String(correct);
      onResult?.(q.id, correct);
    };
    btn.addEventListener('click', submit);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    row.append(inp, btn); wrap.append(row);
  } else if (q.type === 'error') {
    const p = document.createElement('p'); p.className = 'quiz-prompt quiz-error-sentence'; p.textContent = q.sentence; wrap.append(p);
    const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = t('reveal');
    btn.addEventListener('click', () => {
      live.innerHTML = `<strong>${escapeText(q.fix)}</strong> — ${escapeText(pick(q.explain))}`;
      live.dataset.correct = 'true';
      onResult?.(q.id, true);
    });
    wrap.append(btn);
  }
  wrap.append(live);
  return wrap;
}

function escapeText(s) { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
