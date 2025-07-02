import { createStateStore } from "./create_state_store.js";

export const localStorageStateStore = createStateStore(() => {
  const has = (key) => localStorage.getItem(key) !== null;

  const get = (key) => {
    const string = localStorage.getItem(key);
    if (string === null) {
      return undefined;
    }
    return string;
  };

  const set = (key, value) => {
    localStorage.setItem(key, value);
  };

  const remove = (key) => {
    localStorage.removeItem(key);
  };

  return {
    has,
    get,
    set,
    remove,
  };
});
