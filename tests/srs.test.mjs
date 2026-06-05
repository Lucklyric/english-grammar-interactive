import { test } from 'node:test';
import assert from 'node:assert/strict';
import { review, isDue, isMastered, BOX_INTERVALS } from '../assets/js/srs.js';

test('correct answer promotes box and sets due in the future', () => {
  const s = review(undefined, true, 100);
  assert.equal(s.box, 2);
  assert.equal(s.due, 100 + BOX_INTERVALS[2]);
  assert.equal(s.correct, 1);
});

test('wrong answer resets to box 1, due tomorrow', () => {
  const s = review({ box: 4, due: 200, seen: 3, correct: 3 }, false, 100);
  assert.equal(s.box, 1);
  assert.equal(s.due, 100 + BOX_INTERVALS[1]);
});

test('box caps at 5', () => {
  let s = { box: 5, due: 0, seen: 9, correct: 9 };
  s = review(s, true, 100);
  assert.equal(s.box, 5);
});

test('isDue true for unseen and for past-due', () => {
  assert.ok(isDue(undefined, 100));
  assert.ok(isDue({ box: 2, due: 100 }, 105));
  assert.ok(!isDue({ box: 2, due: 110 }, 105));
});

test('isMastered at box >= 4', () => {
  assert.ok(!isMastered({ box: 3 }));
  assert.ok(isMastered({ box: 4 }));
});
