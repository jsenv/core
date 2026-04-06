import { createContext, h } from "preact";
import {
  useContext,
  useEffect,
  useErrorBoundary,
  useState,
} from "preact/hooks";

import { COMPLETED, FAILED, RUNNING } from "../action/action_run_states.js";
import { dismissActionError } from "./use_async_data.js";

const ErrorBoundaryContext = createContext({ silenced: false });
export const useErrorSilenced = () => {
  const { silenced } = useContext(ErrorBoundaryContext);
  return silenced;
};

export const ErrorBoundary = ({ children, fallback, onReset }) => {
  const [error, resetErrorInternal] = useErrorBoundary();
  // Track the action separately so we can still reference it after resetErrorInternal() nulls error
  const [silencedAction, _setSilencedAction] = useState(null);
  const setSilencedAction = (v) => _setSilencedAction(() => v);
  const silenced = silencedAction !== null;

  const resetError = () => {
    const action = error?.action;
    if (action) {
      dismissActionError(action);
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
      setSilencedAction(action);
      resetErrorInternal();
      return undefined;
    }
    const unsubscribe = action.runningStateSignal.subscribe((state) => {
      if (state === RUNNING) {
        unsubscribe();
        setSilencedAction(action);
        resetErrorInternal();
      }
    });
    return unsubscribe;
  }, [error]);

  // Clear silencedAction once the action settles so the real fallback shows again on next run
  useEffect(() => {
    if (!silencedAction) {
      return undefined;
    }
    const currentState = silencedAction.runningStateSignal.peek();
    if (currentState === COMPLETED || currentState === FAILED) {
      setSilencedAction(null);
      return undefined;
    }
    const unsubscribe = silencedAction.runningStateSignal.subscribe((state) => {
      if (state === COMPLETED || state === FAILED) {
        unsubscribe();
        setSilencedAction(null);
      }
    });
    return unsubscribe;
  }, [silencedAction]);

  if (error) {
    if (!fallback) {
      return null;
    }
    error.__handled_by__ = "<ErrorBoundary>"; // prevent jsenv from displaying it
    if (typeof fallback === "function") {
      return h(fallback, { error, resetError });
    }
    return fallback;
  }
  return (
    <ErrorBoundaryContext.Provider value={{ silenced }}>
      {children}
    </ErrorBoundaryContext.Provider>
  );
};
