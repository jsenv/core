import { useEffect, useRef } from "preact/hooks";

const idUsageMap = new Map();
const useNavStateWithWarnings = (id, initialValue, options) => {
  const idRef = useRef(undefined);
  if (import.meta.dev && idRef.current !== id) {
    const oldId = idRef.current;
    idUsageMap.delete(oldId);
    idRef.current = id;

    const usage = idUsageMap.get(id);
    if (!usage) {
      idUsageMap.set(id, {
        stackTrace: new Error().stack,
      });
    } else {
      console.warn(
        `useNavState ID conflict detected!
ID "${id}" is already in use by another component.
This can cause UI state conflicts and unexpected behavior.
Consider using unique IDs for each component instance.`,
      );
    }
  }

  useEffect(() => {
    return () => {
      idUsageMap.delete(id);
    };
  }, [id]);

  return useNavStateWithoutWarnings(id, initialValue, options);
};

const NOT_SET = {};
const NO_OP = () => {};
const useNavStateWithoutWarnings = (id, initialValue, { debug } = {}) => {
  const navStateRef = useRef(NOT_SET);
  if (!id) {
    return [navStateRef.current, NO_OP];
  }

  if (navStateRef.current === NOT_SET) {
    const navEntryState = navigation.currentEntry.getState();
    const valueFromNavState = navEntryState ? navEntryState[id] : undefined;
    if (valueFromNavState === undefined) {
      navStateRef.current = initialValue;
      if (initialValue !== undefined) {
        console.debug(
          `useNavState(${id}) initial value is ${initialValue} (from initialValue passed in as argument)`,
        );
      }
    } else {
      navStateRef.current = valueFromNavState;
      if (debug) {
        console.debug(
          `useNavState(${id}) initial value is ${initialValue} (from nav state)`,
        );
      }
    }
  }

  return [
    navStateRef.current,
    (value) => {
      const currentValue = navStateRef.current;
      if (typeof value === "function") {
        value = value(currentValue);
      }
      if (debug) {
        console.debug(
          `useNavState(${id}) set ${value} (previous was ${currentValue})`,
        );
      }
      const currentState = navigation.currentEntry.getState() || {};
      if (value === undefined) {
        delete currentState[id];
      } else {
        currentState[id] = value;
      }
      navigation.updateCurrentEntry({
        state: currentState,
      });
    },
  ];
};

export const useNavState = import.meta.dev
  ? useNavStateWithWarnings
  : useNavStateWithoutWarnings;
