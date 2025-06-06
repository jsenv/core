import { useCallback, useRef } from "preact/hooks";
import { useSPAFormStatus } from "../components/use_spa_form_status.js";

export const useOptimisticUIState = (
  frontendMemoryState,
  name,
  { revertOnFailure, saveNav } = {},
) => {
  const [navState, navStateSetter] = useNavigationState(name);
  const { pending } = useSPAFormStatus();
  const optimisticStateRef = useRef(frontendMemoryState);
  if (!pending && revertOnFailure) {
    optimisticStateRef.current = frontendMemoryState;
  }
  const setOptimisticState = useCallback((value) => {
    optimisticStateRef.current = value;
    navStateSetter(value);
  }, []);

  return [
    !saveNav || navState === undefined ? optimisticStateRef.current : navState,
    setOptimisticState,
  ];
};

const none = {};
const useNavigationState = (name) => {
  const navStateRef = useRef(none);
  if (navStateRef.current === none) {
    const navEntryState = navigation.currentEntry.getState();
    navStateRef.current = navEntryState ? navEntryState[name] : undefined;
  }
  return [
    navStateRef.current,
    (value) => {
      navStateRef.current = value;
      const currentState = navigation.currentEntry.getState() || {};
      const newState = { ...currentState, [name]: value };
      navigation.updateCurrentEntry({
        state: newState,
      });
    },
  ];
};
