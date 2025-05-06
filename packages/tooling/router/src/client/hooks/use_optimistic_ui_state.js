import { useRef, useLayoutEffect, useCallback, useState } from "preact/hooks";
import { useSPAFormStatus } from "../components/use_spa_form_status.js";

export const useOptimisticUIState = (frontendMemoryState) => {
  const { pending, aborted } = useSPAFormStatus();
  const optimisticStateRef = useRef(frontendMemoryState);
  const [, setAborted] = useState(false);

  // console.log(`optimistic ${name}`, { pending, aborted });

  useLayoutEffect(() => {
    if (!pending) {
      // console.log("stop being pending");
      optimisticStateRef.current = frontendMemoryState;
    } else if (aborted) {
      // console.log("aborted");
      optimisticStateRef.current = frontendMemoryState;
    }
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
