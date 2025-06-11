import { useRef, useState } from "preact/hooks";

const none = {};
export const useNavState = (id, defaultValue) => {
  const navStateRef = useRef(none);
  if (navStateRef.current === none) {
    const navEntryState = navigation.currentEntry.getState();
    navStateRef.current =
      navEntryState && id ? navEntryState[id] : defaultValue;
  }

  const [value, setValue] = useState(navStateRef.current);

  return [
    value,
    (value) => {
      const currentValue = navStateRef.current;
      if (typeof value === "function") {
        value = value(currentValue);
      }
      navStateRef.current = value;
      setValue(value);
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
