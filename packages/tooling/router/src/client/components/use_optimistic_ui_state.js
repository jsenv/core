import { useRef, useLayoutEffect, useCallback } from "preact/hooks";
import { useSPAFormStatus } from "../hooks/use_spa_form_status.js";

export const useOptimisticUIState = (frontendMemoryState) => {
  const { pending } = useSPAFormStatus();
  const UIStateRef = useRef(frontendMemoryState);
  useLayoutEffect(() => {
    if (!pending) {
      UIStateRef.current = frontendMemoryState;
    }
  }, [frontendMemoryState, pending]);
  const setUIState = useCallback((value) => {
    UIStateRef.current = value;
  }, []);
  return [UIStateRef.current, setUIState];
};
