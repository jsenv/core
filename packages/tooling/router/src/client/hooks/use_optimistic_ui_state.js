import { useRef, useLayoutEffect, useCallback, useState } from "preact/hooks";
import { useSPAFormStatus } from "../components/use_spa_form_status.js";

export const useOptimisticUIState = (frontendMemoryState) => {
  const { pending, aborted } = useSPAFormStatus();
  const optimisticStateRef = useRef(frontendMemoryState);
  const [, setAborted] = useState(false);
  const pendingPreviousRef = useRef(pending);
  const abortedPreviousRef = useRef(aborted);
  useLayoutEffect(() => {
    if (pendingPreviousRef.current && !pending) {
      optimisticStateRef.current = frontendMemoryState;
      // console.log("done, frontend memory state is ", frontendMemoryState);
    } else if (!abortedPreviousRef.current && aborted) {
      optimisticStateRef.current = frontendMemoryState;
    }
    pendingPreviousRef.current = pending;
    abortedPreviousRef.current = aborted;
  }, [frontendMemoryState, pending, aborted]);

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
