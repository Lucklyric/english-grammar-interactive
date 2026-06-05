// Conservative fill normalization: trim + collapse internal whitespace + lowercase.
// Does NOT strip internal spaces or hyphens (so "some time" != "sometime").
export function normalizeFill(s) {
  return String(s).trim().replace(/\s+/g, ' ').toLowerCase();
}
export function fillCorrect(input, answers) {
  const n = normalizeFill(input);
  return answers.some((a) => normalizeFill(a) === n);
}
