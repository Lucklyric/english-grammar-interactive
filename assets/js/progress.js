// Per-lesson progress in localStorage under egi:v1. reset() clears only egi:* keys.
const ROOT = 'egi:v1:progress';
const read = () => { try { return JSON.parse(localStorage.getItem(ROOT)) || { schemaVersion: 1, lessons: {} }; } catch { return { schemaVersion: 1, lessons: {} }; } };
const write = (s) => localStorage.setItem(ROOT, JSON.stringify(s));
export function markOpened(id) { const s = read(); (s.lessons[id] ||= {}).opened = true; write(s); }
export function markComplete(id) { const s = read(); (s.lessons[id] ||= {}).complete = true; write(s); }
export function isComplete(id) { return !!read().lessons[id]?.complete; }
export function recordQuiz(id, qid, correct) { const s = read(); const l = (s.lessons[id] ||= {}); l.quiz ||= {}; l.quiz[qid] = (l.quiz[qid] === 1 || correct) ? 1 : 0; write(s); }
export function lessonState(id) { return read().lessons[id] || {}; }
export function completedCount() { return Object.values(read().lessons).filter((l) => l.complete).length; }
export function resetAll() { Object.keys(localStorage).filter((k) => k.startsWith('egi:')).forEach((k) => localStorage.removeItem(k)); }
