// Storage adapter.
//
// CURRENT: localStorage — works instantly, but data lives only in each
// visitor's own browser (no shared community data between users).
//
// FOR A REAL MULTI-USER LAUNCH: replace these four functions with calls to a
// backend such as Supabase (free tier is plenty). Each function keeps the
// same signature, so App.jsx never needs to change.

window.storage = {
  async get(key) {
    const value = localStorage.getItem('hh:' + key);
    if (value === null) return null;
    return { key, value };
  },
  async set(key, value) {
    localStorage.setItem('hh:' + key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem('hh:' + key);
    return { key, deleted: true };
  },
  async list(prefix = '') {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith('hh:' + prefix)) keys.push(k.slice(3));
    }
    return { keys, prefix };
  },
};
