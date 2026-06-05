import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFill, fillCorrect } from '../assets/js/quizlib.mjs';

test('normalizeFill keeps internal spaces/hyphens distinct', () => {
  assert.equal(normalizeFill('  Some Time '), 'some time');
  assert.notEqual(normalizeFill('some time'), normalizeFill('sometime'));
});

test('fillCorrect matches against accepted variants', () => {
  assert.ok(fillCorrect('Sometime', ['sometime']));
  assert.ok(!fillCorrect('some time', ['sometime']));
});
