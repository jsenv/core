import { createContext } from "preact";
import { Suspense } from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { RUNNING } from "../../action/action_run_states.js";

// useAction writes { action } into this ref before throwing a promise,
// so LoadingFallback knows which action to subscribe to and whether to show the fallback.
export const LoadingContext = createContext(null);

const LoadingFallback = ({ loadingRef, fallback }) => {
  const [, setTick] = useState(0);
  const action = loadingRef.current.action;
  useEffect(() => {
    if (!action) {
      return undefined;
    }
    return action.runningStateSignal.subscribe(() => {
      setTick((n) => n + 1);
    });
  }, [action]);
  const currentAction = loadingRef.current.action;
  if (currentAction && currentAction.runningStateSignal.peek() === RUNNING) {
    return fallback;
  }
  return null;
};

export const Loading = ({ children, fallback }) => {
  const loadingRef = useRef({ action: null });
  if (!fallback) {
    // No fallback — children handle loading state via useAsyncData({ loading })
    return children;
  }
  return (
    <LoadingContext.Provider value={loadingRef}>
      <Suspense
        fallback={
          <LoadingFallback loadingRef={loadingRef} fallback={fallback} />
        }
      >
        {children}
      </Suspense>
    </LoadingContext.Provider>
  );
};
