import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSpans, findOverlaps, checkCounts, SHAPE_TIERS } from '../tools/lib/lint.mjs';

test('resolveSpans maps quote+occurrence to char ranges', () => {
  const text = 'the other is from you, the other is also from you';
  const spans = resolveSpans(text, [{ quote: 'the other', tag: 'subject', occurrence: 1 }, { quote: 'the other', tag: 'subject', occurrence: 2 }]);
  assert.equal(spans[0].start, 0);
  assert.equal(spans[1].start, text.indexOf('the other', 1));
});

test('resolveSpans throws when ambiguous occurrence missing', () => {
  assert.throws(() => resolveSpans('other and other', [{ quote: 'other', tag: 'attributive' }]), /ambiguous/);
});

test('resolveSpans throws when quote absent', () => {
  assert.throws(() => resolveSpans('hello', [{ quote: 'xyz', tag: 'subject' }]), /not found/);
});

test('findOverlaps detects intersecting spans', () => {
  const overlaps = findOverlaps([{ start: 0, end: 11 }, { start: 4, end: 9 }]);
  assert.equal(overlaps.length, 1);
});

test('findOverlaps allows adjacent non-overlapping spans', () => {
  assert.equal(findOverlaps([{ start: 0, end: 5 }, { start: 5, end: 9 }]).length, 0);
});

test('checkCounts enforces shape tiers', () => {
  assert.equal(checkCounts('tiny', { concepts: 2, examples: 3, quizzes: 2 }).length, 0);
  assert.ok(checkCounts('standard', { concepts: 1, examples: 4, quizzes: 4 }).length > 0);
  assert.equal(checkCounts('deep-dive', { concepts: 16, examples: 16, quizzes: 8 }).length, 0);
});

test('SHAPE_TIERS deep-dive ceiling admits 16+ concepts', () => {
  assert.ok(SHAPE_TIERS['deep-dive'].concepts[1] >= 20);
});
