import { useRef, useLayoutEffect, useCallback } from "preact/hooks";
import { useSPAFormStatus } from "../components/use_spa_form_status.js";

export const useOptimisticUIState = (frontendMemoryState) => {
  const { pending, aborted } = useSPAFormStatus();
  const UIStateRef = useRef(frontendMemoryState);

  useLayoutEffect(() => {
    if (!pending) {
      UIStateRef.current = frontendMemoryState;
    }
  }, [frontendMemoryState, pending]);

  useLayoutEffect(() => {
    if (aborted) {
      console.log("form aborted");
      UIStateRef.current = frontendMemoryState;
    }
  }, [frontendMemoryState, aborted]);

  const setUIState = useCallback((value) => {
    UIStateRef.current = value;
  }, []);

  return [UIStateRef.current, setUIState];
};
