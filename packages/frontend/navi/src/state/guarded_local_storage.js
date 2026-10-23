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
