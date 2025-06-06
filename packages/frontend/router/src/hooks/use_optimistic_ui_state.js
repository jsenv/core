import { useCallback, useRef } from "preact/hooks";
import { useSPAFormStatus } from "../components/use_spa_form_status.js";

export const useOptimisticUIState = (
  frontendMemoryState,
  name,
  { revertOnFailure } = {},
) => {
  const { pending } = useSPAFormStatus();
  const optimisticStateRef = useRef(frontendMemoryState);
  if (!pending && revertOnFailure) {
    optimisticStateRef.current = frontendMemoryState;
  }
  const setOptimisticState = useCallback((value) => {
    optimisticStateRef.current = value;
  }, []);

  return [optimisticStateRef.current, setOptimisticState];
};
