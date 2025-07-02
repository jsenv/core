import { createStateStore } from "./create_state_store.js";

export const navigatorStateStore = createStateStore(() => {
  const state = navigation.currentEntry.getState() || {};

  const has = (key) => {
    return Object.hasOwn(state, key);
  };

  const get = (key) => {
    return state[key];
  };

  const setAll = (value) => {
    navigation.updateCurrentEntry({ state: value });
  };

  return { has, get, setAll };
});
