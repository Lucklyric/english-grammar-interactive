import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotateToHTML } from '../assets/js/annotate.js';

const tags = {
  subject: { abbr: 'S', color: '#00f', underline: 'solid', label: { en: 'subject', zh: '主语' } },
  object:  { abbr: 'O', color: '#0a0', underline: 'dashed', label: { en: 'object', zh: '宾语' } },
};

test('wraps spans and escapes HTML, preserves order', () => {
  const html = annotateToHTML('Papa likes <b>you</b>', [{ quote: 'Papa', tag: 'subject' }], tags, 'en');
  assert.ok(html.startsWith('<span class="anno"'));
  assert.ok(html.includes('&lt;b&gt;'));
  assert.ok(html.includes('aria-label="subject"'));
});

test('non-annotated text passes through escaped', () => {
  const html = annotateToHTML('a & b', [], tags, 'en');
  assert.equal(html, 'a &amp; b');
});
