// Leitner 5-box spaced repetition over the vocabulary. Pure logic + a localStorage store.
// State per word: { box (1..5), due (day-number), seen, correct }.

export const BOX_INTERVALS = [0, 1, 2, 4, 7, 15]; // index = box; days until next due

// today's day-number (UTC days since epoch); injectable for tests.
export function dayNumber(now = Date.now()) { return Math.floor(now / 86400000); }

// Pure transition: given prior state (or undefined) + correctness, return next state.
export function review(prev, correct, today = dayNumber()) {
  const box = prev?.box || 1;
  const nextBox = correct ? Math.min(5, box + 1) : 1;
  return {
    box: nextBox,
    due: today + BOX_INTERVALS[nextBox],
    seen: (prev?.seen || 0) + 1,
    correct: (prev?.correct || 0) + (correct ? 1 : 0),
  };
}

export function isMastered(state) { return !!state && state.box >= 4; }
export function isDue(state, today = dayNumber()) { return !state || state.due <= today; }

// localStorage-backed store (browser only).
const KEY = 'egi:v1:vocab';
function read() { try { return JSON.parse(localStorage.getItem(KEY)) || { schemaVersion: 1, words: {} }; } catch { return { schemaVersion: 1, words: {} }; } }
function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

export const store = {
  get(w) { return read().words[w]; },
  record(w, correct) { const s = read(); s.words[w] = review(s.words[w], correct); write(s); return s.words[w]; },
  // ids: array of headwords to consider; returns those due today.
  due(ids) { const s = read(); const t = dayNumber(); return ids.filter((w) => isDue(s.words[w], t)); },
  masteredCount(ids) { const s = read(); return ids.filter((w) => isMastered(s.words[w])).length; },
  reset() { Object.keys(localStorage).filter((k) => k.startsWith('egi:')).forEach((k) => localStorage.removeItem(k)); },
};
