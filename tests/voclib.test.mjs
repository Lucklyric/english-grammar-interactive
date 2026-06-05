import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer, answerCorrect, wpm, gapFill, levenshtein, gradeTyped, scramble, pickDistractors } from '../assets/js/voclib.mjs';

test('normalizeAnswer trims, collapses, lowercases', () => {
  assert.equal(normalizeAnswer('  Hello   World '), 'hello world');
});

test('answerCorrect is case/space-insensitive', () => {
  assert.ok(answerCorrect('Abandon', 'abandon'));
  assert.ok(!answerCorrect('abandons', 'abandon'));
});

test('wpm computes 5-char words per minute', () => {
  assert.equal(wpm(25, 60000), 5);
  assert.equal(wpm(0, 0), 0);
});

test('gapFill replaces the blank substring', () => {
  const g = gapFill('They had to abandon the car.', 'abandon');
  assert.equal(g.prompt, 'They had to ____ the car.');
  assert.equal(g.answer, 'abandon');
});

test('gapFill returns null when blank missing', () => {
  assert.equal(gapFill('no match here', 'xyz'), null);
});

test('levenshtein basic distances', () => {
  assert.equal(levenshtein('cat', 'cat'), 0);
  assert.equal(levenshtein('abandon', 'abandom'), 1);
  assert.equal(levenshtein('', 'abc'), 3);
});

test('gradeTyped: exact correct, one-typo near on long words, short words strict', () => {
  assert.deepEqual(gradeTyped('Abandon', 'abandon'), { correct: true, near: false });
  assert.deepEqual(gradeTyped('abandom', 'abandon'), { correct: false, near: true });
  assert.deepEqual(gradeTyped('car', 'cat'), { correct: false, near: false }); // 3-char: no near
  assert.deepEqual(gradeTyped('zzz', 'abandon'), { correct: false, near: false });
});

test('scramble keeps the same letters', () => {
  const s = scramble('beautiful');
  assert.deepEqual(s.split('').sort(), 'beautiful'.split('').sort());
});

test('pickDistractors excludes correct and returns n', () => {
  const d = pickDistractors('a', ['a', 'b', 'c', 'd'], 2);
  assert.equal(d.length, 2);
  assert.ok(!d.includes('a'));
});
