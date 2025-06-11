import { useRef } from "preact/hooks";

const none = {};
export const useNavState = (id) => {
  const navStateRef = useRef(none);
  if (navStateRef.current === none) {
    const navEntryState = navigation.currentEntry.getState();
    navStateRef.current = navEntryState && id ? navEntryState[id] : undefined;
  }
  return [
    navStateRef.current,
    (value) => {
      navStateRef.current = value;
      if (!id) {
        return;
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
