import { useRef, useLayoutEffect, useCallback, useState } from "preact/hooks";
import { useSPAFormStatus } from "../components/use_spa_form_status.js";

export const useOptimisticUIState = (frontendMemoryState) => {
  const { pending, aborted, error } = useSPAFormStatus();
  const optimisticStateRef = useRef(frontendMemoryState);
  const [, setAborted] = useState(false);
  const [, setError] = useState(false);

  if (!pending || aborted || error) {
    optimisticStateRef.current = frontendMemoryState;
  }

  useLayoutEffect(() => {
    if (pending) {
      setAborted(false);
      setError(false);
    }
  }, [pending]);
  useLayoutEffect(() => {
    if (aborted) {
      setAborted(true);
    }
  }, [aborted]);
  useLayoutEffect(() => {
    if (error) {
      setError(true);
    }
  }, [error]);

  const setOptimisticState = useCallback((value) => {
    optimisticStateRef.current = value;
  }, []);

  return [optimisticStateRef.current, setOptimisticState];
};
