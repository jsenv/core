import { useEffect, useRef } from "preact/hooks";

const idUsageMap = new Map();
const useNavStateWithWarnings = (id, initialValue) => {
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

  return useNavStateWithoutWarnings(id, initialValue);
};

const NONE = {};
const useNavStateWithoutWarnings = (id, initialValue) => {
  const navStateRef = useRef(NONE);
  if (navStateRef.current === NONE) {
    const navEntryState = navigation.currentEntry.getState();
    navStateRef.current =
      navEntryState && id ? navEntryState[id] : initialValue;
  }

  return [
    navStateRef.current,
    (value) => {
      const currentValue = navStateRef.current;
      if (typeof value === "function") {
        value = value(currentValue);
      }
      navStateRef.current = value;
      if (id) {
        const currentState = navigation.currentEntry.getState() || {};
        if (value === undefined) {
          delete currentState[id];
        } else {
          currentState[id] = value;
        }
        navigation.updateCurrentEntry({
          state: currentState,
        });
      }
    },
  ];
};

export const useNavState = import.meta.dev
  ? useNavStateWithWarnings
  : useNavStateWithoutWarnings;
