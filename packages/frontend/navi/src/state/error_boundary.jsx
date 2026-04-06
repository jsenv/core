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
  const [silenced, setSilenced] = useState(false);

  const resetError = () => {
    const action = error?.action;
    if (action) {
      dismissActionError(action);
      setSilenced(true);
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
    const unsubscribe = action.runningStateSignal.subscribe((state) => {
      if (state === RUNNING) {
        unsubscribe();
        setSilenced(true);
        resetErrorInternal();
      }
    });
    return unsubscribe;
  }, [error]);

  // Clear silenced once the action settles so the real fallback can show again on next run
  useEffect(() => {
    if (!silenced) {
      return undefined;
    }
    const action = error?.action;
    if (!action) {
      return undefined;
    }
    const unsubscribe = action.runningStateSignal.subscribe((state) => {
      if (state === COMPLETED || state === FAILED) {
        unsubscribe();
        setSilenced(false);
      }
    });
    return unsubscribe;
  }, [silenced]);

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
