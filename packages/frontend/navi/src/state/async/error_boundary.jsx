// Error boundary is also capable to catch sync errors but still
// it's mostly useful to catch async errors

import { createContext, h } from "preact";
import {
  useContext,
  useEffect,
  useErrorBoundary,
  useRef,
  useState,
} from "preact/hooks";

import { RUNNING } from "../../action/action_run_states.js";

const ErrorBoundaryContext = createContext({
  hasBoundary: false,
  silencedAction: null,
});
export const useHasErrorBoundary = () => {
  const { hasBoundary } = useContext(ErrorBoundaryContext);
  return hasBoundary;
};
export const useSilencedAction = () => {
  const { silencedAction } = useContext(ErrorBoundaryContext);
  return silencedAction;
};

export const ErrorBoundary = ({ children, fallback, onReset }) => {
  const [error, resetErrorInternal] = useErrorBoundary();
  // Track the action separately so we can still reference it after resetErrorInternal() nulls error
  const [silenced, setSilenced] = useState(false);
  const actionRef = useRef(null);

  const unsubscribeRef = useRef(null);
  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);
  const resetError = () => {
    setSilenced(true);
    onReset?.();
    resetErrorInternal();
  };

  if (error) {
    error.__handled_by__ = "<ErrorBoundary>"; // prevent jsenv from displaying it
    const action = error.action;
    actionRef.current = action;
    unsubscribeRef.current?.();
    if (action) {
      // when action runs, auto reset error
      const unsubscribe = action.runningStateSignal.subscribe((state) => {
        if (state === RUNNING) {
          unsubscribe();
          unsubscribeRef.current = null;
          setSilenced(false);
          resetErrorInternal();
        }
      });
      if (silenced && actionRef.current === action) {
        return null;
      }
    }
    if (!fallback) {
      return null;
    }
    if (typeof fallback === "function") {
      return h(fallback, { error, resetError });
    }
    return fallback;
  }
  return (
    <ErrorBoundaryContext.Provider
      value={{
        hasBoundary: true,
        silencedAction: silenced ? actionRef.current : null,
      }}
    >
      {children}
    </ErrorBoundaryContext.Provider>
  );
};
