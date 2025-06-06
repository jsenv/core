export const navigatorStore = {
  getReadonlyState: () => {
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
  },
  mutate: (callback) => {
    const state = navigation.currentEntry.getState() || {};
    const newState = { ...state };
    let mutationCount = 0;
    const writableState = new Proxy(state, {
      set(target, prop, value) {
        const newStateValue = Object.hasOwn(newState, prop)
          ? newState[prop]
          : NOT_FOUND;
        if (value === newStateValue) {
          return true;
        }
        const currentStateValue = Object.hasOwn(state, prop)
          ? state[prop]
          : NOT_FOUND;
        if (value === currentStateValue) {
          // going back to the previous value
          newState[prop] = value;
          mutationCount--;
          return true;
        }
        mutationCount++;
        newState[prop] = value;
        return true;
      },
      deleteProperty(target, prop) {
        if (!Object.hasOwn(newState, prop)) {
          return true;
        }
        mutationCount++;
        delete newState[prop];
        return true;
      },
    });
    callback(writableState);
    return mutationCount === 0 ? null : newState;
  },
  set: (value) => {
    navigation.updateCurrentEntry({ state: value });
  },
};

const NOT_FOUND = {};
