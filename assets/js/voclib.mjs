// Pure helpers for the vocabulary drills (importable by tests + browser).

// Answer normalization for typed input: trim + collapse internal whitespace + lowercase.
export function normalizeAnswer(s) {
  return String(s).trim().replace(/\s+/g, ' ').toLowerCase();
}
export function answerCorrect(input, expected) {
  return normalizeAnswer(input) === normalizeAnswer(expected);
}

// Words-per-minute from chars typed and elapsed ms (standard: 5 chars = 1 word).
export function wpm(chars, ms) {
  if (!ms || ms <= 0) return 0;
  return Math.round((chars / 5) / (ms / 60000));
}

// Build the gap-fill prompt: replace the first occurrence of `blank` in `example` with a blank.
// Returns { prompt, answer } or null if blank is not a substring.
export function gapFill(example, blank) {
  if (!example || !blank) return null;
  const i = example.indexOf(blank);
  if (i === -1) return null;
  return { prompt: example.slice(0, i) + '____' + example.slice(i + blank.length), answer: blank };
}

// Levenshtein edit distance.
export function levenshtein(a, b) {
  a = a || ''; b = b || '';
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => { const r = new Array(n + 1).fill(0); r[0] = i; return r; });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

// Grade typed input: exact = correct; one typo on a >=4-char word = "near" (accepted, flagged).
export function gradeTyped(input, expected) {
  const a = normalizeAnswer(input), b = normalizeAnswer(expected);
  if (a === b) return { correct: true, near: false };
  const near = b.length >= 4 && levenshtein(a, b) === 1;
  return { correct: false, near };
}

// Shuffle a word's letters (result differs from original when possible).
export function scramble(word) {
  const arr = String(word).split('');
  if (arr.length < 2) return word;
  let out = arr;
  for (let k = 0; k < 10; k++) {
    out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    if (out.join('') !== word) break;
  }
  return out.join('');
}

// Pick n distractors from a pool, excluding the correct value.
export function pickDistractors(correct, pool, n) {
  const opts = pool.filter((x) => x !== correct);
  for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
  return opts.slice(0, n);
}
