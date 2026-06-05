// Pure, dependency-free lint helpers. Throw on hard errors; return arrays of issue strings on soft checks.

// Example ceilings are generous: enumeration lessons (16 tenses, non-finite, prepositions)
// legitimately carry one example per item. Concept/quiz ranges bound the teaching effort.
export const SHAPE_TIERS = {
  tiny:        { concepts: [2, 6],  examples: [2, 10], quizzes: [2, 5] },
  standard:    { concepts: [4, 10], examples: [4, 18], quizzes: [4, 8] },
  'deep-dive': { concepts: [8, 24], examples: [6, 48], quizzes: [6, 14] },
};

// Resolve each annotation to a {start,end,tag} char range. Throws on not-found / ambiguous.
export function resolveSpans(text, annotations) {
  return annotations.map((a) => {
    const occ = a.occurrence ?? 1;
    let count = 0, idx = -1, from = 0, foundAt = -1, nth = 0;
    while ((idx = text.indexOf(a.quote, from)) !== -1) {
      count++; nth++;
      if (nth === occ) foundAt = idx;
      from = idx + 1;
    }
    if (count === 0) throw new Error(`quote not found: "${a.quote}"`);
    if (count > 1 && a.occurrence === undefined) throw new Error(`ambiguous quote (occurs ${count}x, set occurrence): "${a.quote}"`);
    if (foundAt === -1) throw new Error(`occurrence ${occ} out of range for "${a.quote}" (occurs ${count}x)`);
    return { start: foundAt, end: foundAt + a.quote.length, tag: a.tag };
  });
}

// Return list of overlapping span pairs (intersecting char ranges). Adjacent (end==start) is OK.
export function findOverlaps(spans) {
  const sorted = [...spans].sort((x, y) => x.start - y.start);
  const out = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) out.push([sorted[i - 1], sorted[i]]);
  }
  return out;
}

// Return issue strings if counts fall outside the shape tier.
export function checkCounts(shape, counts) {
  const tier = SHAPE_TIERS[shape];
  if (!tier) return [`unknown shape: ${shape}`];
  const issues = [];
  for (const k of ['concepts', 'examples', 'quizzes']) {
    const [lo, hi] = tier[k];
    if (counts[k] < lo || counts[k] > hi) issues.push(`${k}=${counts[k]} outside ${shape} tier [${lo},${hi}]`);
  }
  return issues;
}
