export const createStateStore = (getHooks) => {
  const getReadonlyState = () => {
    const hooks = getHooks();
    const target = {};
    const readableState = new Proxy(target, {
      get(target, prop) {
        const value = hooks.get(prop);
        return value;
      },
      has(target, prop) {
        return hooks.has(prop);
      },
      set() {
        console.warn("Cannot set property: state is readonly.");
        return false;
      },
      deleteProperty() {
        console.warn("Cannot delete property: state is readonly.");
        return false;
      },
      defineProperty() {
        console.warn("Cannot define property: state is readonly.");
        return false;
      },
    });
    return readableState;
  };

  const mutate = (callback) => {
    const hooks = getHooks();
    const newState = {};
    const addedPropertyMap = new Map();
    const deletedPropertySet = new Set();
    const modifiedPropertyMap = new Map();

    const writableState = new Proxy(
      {},
      {
        set(target, prop, value) {
          const newStateValue = Object.hasOwn(newState, prop)
            ? newState[prop]
            : NOT_FOUND;
          if (value === newStateValue) {
            // no changes, nothing to do
            return false;
          }
          const currentStateValue = hooks.has(prop)
            ? hooks.get(prop)
            : NOT_FOUND;
          if (value === currentStateValue) {
            // going back to the initial state value
            newState[prop] = value;
            modifiedPropertyMap.delete(prop);
            return true;
          }
          if (currentStateValue === NOT_FOUND) {
            // adding this property for the first time
            // or updating this property value again, but that's still a new property regarding the previous state
            newState[prop] = value;
            addedPropertyMap.set(prop, value);
            return true;
          }
          newState[prop] = value;
          modifiedPropertyMap.set(prop, value);
          return true;
        },
        deleteProperty(target, prop) {
          const stateHasProp = hooks.has(prop);
          const newStateHasProp = Object.hasOwn(newState, prop);
          if (!stateHasProp && !newStateHasProp) {
            return false;
          }
          if (!stateHasProp && newStateHasProp) {
            // going back to state without this property
            delete newState[prop];
            addedPropertyMap.delete(prop);
            return true;
          }
          // delete this property
          deletedPropertySet.add(prop);
          return true;
        },
      },
    );
    callback(writableState);

    if (
      addedPropertyMap.size === 0 &&
      modifiedPropertyMap.size === 0 &&
      deletedPropertySet.size === 0
    ) {
      return null;
    }
    return [
      newState,
      () => {
        if (hooks.setAll) {
          hooks.setAll(newState);
          return;
        }
        for (const key of deletedPropertySet) {
          hooks.remove(key);
        }
        for (const key of Object.keys(newState)) {
          const newValue = newState[key];
          hooks.set(key, newValue);
        }
      },
    ];
  };

  return { getReadonlyState, mutate };
};

const NOT_FOUND = {};
