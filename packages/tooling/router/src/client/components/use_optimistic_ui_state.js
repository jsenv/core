import { useRef, useLayoutEffect, useCallback, useEffect } from "preact/hooks";
import { useSPAFormStatus } from "../hooks/use_spa_form_status.js";
import { useActionStatus } from "../action/action_hooks.js";

export const useOptimisticUIState = (frontendMemoryState) => {
  const { pending, action } = useSPAFormStatus();
  const { aborted } = useActionStatus(action);
  const UIStateRef = useRef(frontendMemoryState);
  useLayoutEffect(() => {
    if (!pending) {
      UIStateRef.current = frontendMemoryState;
    }
  }, [frontendMemoryState, pending]);
  useEffect(() => {
    if (aborted) {
      console.log("action aborted");
    }
  }, []);
  const setUIState = useCallback((value) => {
    UIStateRef.current = value;
  }, []);
  return [UIStateRef.current, setUIState];
};
