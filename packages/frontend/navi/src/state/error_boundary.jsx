import { createContext, h } from "preact";
import {
  useContext,
  useEffect,
  useErrorBoundary,
  useState,
} from "preact/hooks";

import { RUNNING } from "../action/action_run_states.js";

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
  const [silencedAction, _setSilencedAction] = useState(null);
  const setSilencedAction = (v) => _setSilencedAction(() => v);

  const resetError = () => {
    const action = error?.action;
    if (action) {
      setSilencedAction(action);
    }
    onReset?.();
    resetErrorInternal();
  };

  // When the failed action re-runs, auto-dismiss the boundary
  useEffect(() => {
    if (!error) {
      return undefined;
    }
    const action = error.action;
    if (!action) {
      return undefined;
    }
    const currentState = action.runningStateSignal.peek();
    if (currentState === RUNNING) {
      setSilencedAction(null);
      resetErrorInternal();
      return undefined;
    }
    const unsubscribe = action.runningStateSignal.subscribe((state) => {
      if (state === RUNNING) {
        unsubscribe();
        setSilencedAction(null);
        resetErrorInternal();
      }
    });
    return unsubscribe;
  }, [error]);

  if (error) {
    error.__handled_by__ = "<ErrorBoundary>"; // prevent jsenv from displaying it
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
      value={{ hasBoundary: true, silencedAction }}
    >
      {children}
    </ErrorBoundaryContext.Provider>
  );
};
