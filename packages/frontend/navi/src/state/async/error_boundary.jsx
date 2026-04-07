// Error boundary is also capable to catch sync errors but still
// it's mostly useful to catch async errors

import { h } from "preact";
import { useEffect, useErrorBoundary, useRef } from "preact/hooks";

import { RUNNING } from "../../action/action_run_states.js";
import { dismissAction } from "./use_async_data.js";

export const ErrorBoundary = ({ children, fallback, onReset }) => {
  const [error, resetErrorInternal] = useErrorBoundary();
  const unsubscribeRef = useRef(null);

  useEffect(() => {
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (!error) {
      return undefined;
    }
    const action = error.action;
    if (!action) {
      return undefined;
    }
    // When action runs again, auto-reset the error boundary
    const unsubscribe = action.runningStateSignal.subscribe((state) => {
      if (state === RUNNING) {
        unsubscribe();
        unsubscribeRef.current = null;
        resetErrorInternal();
      }
    });
    unsubscribeRef.current = unsubscribe;
    return () => {
      unsubscribe();
      unsubscribeRef.current = null;
    };
  }, [error]);

  if (error) {
    error.__handled_by__ = "<ErrorBoundary>"; // prevent jsenv from displaying it
    const action = error.action;
    const resetError = () => {
      if (action) {
        dismissAction(action);
      }
      onReset?.();
      resetErrorInternal();
    };
    if (!fallback) {
      return null;
    }
    if (typeof fallback === "function") {
      return h(fallback, { error, resetError });
    }
    return fallback;
  }
  return children;
};
