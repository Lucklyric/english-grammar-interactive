// Per-unit practice progress for the Everyday English (EEA) track.
// Stored under the shared egi:* namespace so the global Reset clears it too.
const KEY = 'egi:v1:eea';
function read() { try { return JSON.parse(localStorage.getItem(KEY)) || { schemaVersion: 1, units: {} }; } catch { return { schemaVersion: 1, units: {} }; } }
function write(s) { localStorage.setItem(KEY, JSON.stringify(s)); }

// User sound preferences (typing clicks + TTS reading), persisted under the shared namespace.
const PKEY = 'egi:v1:eea:prefs';
const DEFAULTS = { typeSound: true, reading: true };
export const prefs = {
  get() { try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(PKEY) || '{}')); } catch { return { ...DEFAULTS }; } },
  set(key, val) { const p = this.get(); p[key] = val; localStorage.setItem(PKEY, JSON.stringify(p)); return p; },
};

export const estore = {
  get(id) { return read().units[id] || {}; },
  practicedCount() { return Object.values(read().units).filter((u) => u.practiced).length; },
  // Record a finished session for a unit. Keeps the best accuracy / wpm seen.
  record(id, { acc = null, wpm = null } = {}) {
    const s = read(); const u = (s.units[id] ||= {});
    u.practiced = true;
    if (acc != null) u.bestAcc = Math.max(u.bestAcc || 0, acc);
    if (wpm != null) u.bestWpm = Math.max(u.bestWpm || 0, wpm);
    write(s); return u;
  },
};
