export const SAVE_KEY = 'microverse.saves.v1';
export const PREFS_KEY = 'microverse.prefs.v1';

export function loadPrefs(defaults) {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...defaults };
    const data = JSON.parse(raw);
    return { ...defaults, ...(data && typeof data === 'object' ? data : {}) };
  } catch {
    return { ...defaults };
  }
}

export function savePrefs(prefs) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch {}
}

export function loadSaves() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

export function saveSlot(name, payload) {
  const saves = loadSaves();
  saves[name] = { name, savedAt: Date.now(), payload };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saves)); return true; } catch { return false; }
}

export function loadSlot(name) {
  const saves = loadSaves();
  return saves[name] || null;
}

export function deleteSlot(name) {
  const saves = loadSaves();
  if (saves[name]) delete saves[name];
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(saves)); } catch {}
}

export function listSlots() {
  return Object.values(loadSaves()).sort((a,b)=>(b.savedAt||0)-(a.savedAt||0));
}
