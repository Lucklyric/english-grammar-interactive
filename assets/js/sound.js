// Tiny Web Audio synth for UI feedback — no audio files needed. Lazily creates one
// AudioContext (resumed on first user gesture, e.g. the first keystroke). The keystroke
// is modelled on an old mechanical typewriter: a short filtered-noise "clack" plus a low
// thump, with a carriage-return bell on completing a phrase.
let ctx = null;
function ac() {
  if (ctx) return ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  return ctx;
}
function resume(a) { if (a.state === 'suspended') { try { a.resume(); } catch {} } }

// Decaying tone.
function blip(freq, dur, type = 'square', gain = 0.04) {
  const a = ac(); if (!a) return; resume(a);
  const t = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur);
}

// Percussive burst of band-passed noise — the mechanical "clack".
function noise(dur, freq, q, gain) {
  const a = ac(); if (!a) return; resume(a);
  const t = a.currentTime;
  const n = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);   // decaying white noise
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = a.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(a.destination);
  src.start(t); src.stop(t + dur);
}

export const sound = {
  // Typewriter key strike: sharp noise clack + a short low thump (key bottoming out).
  key() { noise(0.035, 1700 + Math.random() * 500, 1.1, 0.22); blip(170, 0.02, 'square', 0.05); },
  // Jammed key — dull low thunk.
  error() { noise(0.16, 320, 0.6, 0.16); blip(120, 0.14, 'sawtooth', 0.04); },
  // Carriage-return bell on finishing a line.
  success() { blip(1760, 0.55, 'sine', 0.07); blip(2640, 0.5, 'sine', 0.025); },
};
