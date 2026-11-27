// A browser refusing storage (blocked site data, some private windows) throws
// on the first touch of window.localStorage, and a full one throws on setItem.
// Either way what was to be kept lives in memory for the session, which is all
// a persisted value can fall back to — so every access goes through here.

export const readLocalStorage = (key) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? undefined : raw;
  } catch {
    return undefined;
  }
};

export const writeLocalStorage = (key, value) => {
  try {
    if (value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Full, or refused: the value lives for the session only.
  }
};

export const listLocalStorageKeys = () => {
  try {
    const keys = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      keys.push(window.localStorage.key(i));
    }
    return keys;
  } catch {
    return [];
  }
};

// Another tab writing the key: `callback` gets the text it holds now
// (`undefined` once removed, or after a clear). The page's own writes are not
// heard, the browser only tells the other tabs.
export const listenLocalStorageKey = (key, callback) => {
  const onstorage = (e) => {
    if (e.key !== key && e.key !== null) {
      return;
    }
    let localStorage;
    try {
      localStorage = window.localStorage;
    } catch {
      return;
    }
    if (e.storageArea !== localStorage) {
      return;
    }
    callback(e.newValue === null ? undefined : e.newValue);
  };
  window.addEventListener("storage", onstorage);
  return () => {
    window.removeEventListener("storage", onstorage);
  };
};
