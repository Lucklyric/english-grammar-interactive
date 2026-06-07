// Tiny Web Audio synth for UI feedback — no audio files needed. Lazily creates one
// AudioContext (resumed on first user gesture, e.g. the first keystroke).
let ctx = null;
function ac() {
  if (ctx) return ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  return ctx;
}
function blip(freq, dur, type = 'square', gain = 0.04) {
  const a = ac(); if (!a) return;
  if (a.state === 'suspended') { try { a.resume(); } catch {} }
  const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur);
}

export const sound = {
  // Soft mechanical keystroke click (slight pitch jitter so it doesn't feel robotic).
  key() { blip(380 + Math.random() * 90, 0.025, 'triangle', 0.05); },
  // Low buzz on a wrong character.
  error() { blip(150, 0.18, 'sawtooth', 0.05); },
  // Two-note rise on completing a phrase.
  success() { blip(620, 0.08, 'sine', 0.05); setTimeout(() => blip(880, 0.11, 'sine', 0.05), 80); },
};
