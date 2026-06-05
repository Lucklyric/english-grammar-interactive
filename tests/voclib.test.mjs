import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer, answerCorrect, wpm, gapFill } from '../assets/js/voclib.mjs';

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
