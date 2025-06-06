const getReadonlyState = () => {
  const state = navigation.currentEntry.getState() || {};
  const readableState = new Proxy(state, {
    set() {
      console.warn(
        "Attempting to set a property on the navigator state is not allowed.",
      );
      return false;
    },
    deleteProperty() {
      console.warn(
        "Attempting to delete a property on the navigator state is not allowed.",
      );
      return false;
    },
    defineProperty() {
      console.warn(
        "Attempting to define a property on the navigator state is not allowed.",
      );
      return false;
    },
  });
  return readableState;
};

const getWritableState = () => {
  const state = navigation.currentEntry.getState() || {};
  const writableState = new Proxy(state, {
    set(target, prop, value) {
      state[prop] = value;
      debugger;
      navigation.updateCurrentEntry({ state });
      return true;
    },
    deleteProperty(target, prop) {
      delete target[prop];
      navigation.updateCurrentEntry({ state });
      return true;
    },
    defineProperty(target, prop, descriptor) {
      Object.defineProperty(target, prop, descriptor);
      navigation.updateCurrentEntry({ state });
      return true;
    },
  });
  return writableState;
};

export const navigatorStore = { getReadonlyState, getWritableState };
