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
