# English Grammar — Interactive

An interactive, bilingual (中文/English) English-grammar course adapted from the
英语兔 (English Rabbit) YouTube grammar series.

**Live site:** https://lucklyric.github.io/english-grammar-interactive/
**A lesson deep link:** https://lucklyric.github.io/english-grammar-interactive/lesson.html?id=01

Static site — no build step. For local development, serve over HTTP (not file://):

    python3 -m http.server 8000   # then open http://localhost:8000/

Validate content: `node tools/validate.mjs`
Run unit tests: `node --test tests/*.test.mjs`

## Tracks

- **Grammar** (`index.html`) — bilingual grammar lessons.
- **Vocabulary** (`vocab.html`) — Basic English 850 → CEFR C2 typing drills with spaced review.
- **Everyday** (`eea.html`) — everyday-activity phrase bank adapted from *English For Everyday
  Activities*, organized by section → unit with composite `SId-Uid` ids (e.g. `s1-01`, `s2-c01`).
  Three study modes: English flashcard, 中文 flashcard, and Chinese-only typing (MonkeyType-style
  single line). Fully data-driven — add a unit JSON to `data/eea/units/` (with a `section` field)
  or a section to `data/eea/sections.json`, then rebuild: `node tools/eea-build-index.mjs`.

## Attribution

Independent learning adaptation. **Not** official 英语兔 material. Each lesson links to
its original source video. Source-creator licensing is handled separately by the maintainer.
