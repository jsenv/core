import { useRef, useLayoutEffect, useCallback, useState } from "preact/hooks";
import { useSPAFormStatus } from "../components/use_spa_form_status.js";

export const useOptimisticUIState = (frontendMemoryState) => {
  const { pending, aborted } = useSPAFormStatus();
  const optimisticStateRef = useRef(frontendMemoryState);
  const [, setAborted] = useState(false);

  if (!pending || aborted) {
    optimisticStateRef.current = frontendMemoryState;
  }

  useLayoutEffect(() => {
    if (pending) {
      setAborted(false);
    }
  }, [pending]);
  useLayoutEffect(() => {
    if (aborted) {
      setAborted(true);
    }
  }, [aborted]);

  const setOptimisticState = useCallback((value) => {
    optimisticStateRef.current = value;
  }, []);

  return [optimisticStateRef.current, setOptimisticState];
};
