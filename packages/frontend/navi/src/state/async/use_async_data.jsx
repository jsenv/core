// https://github.com/preactjs/preact/issues/4756

import { createContext, h } from "preact";
import { Suspense } from "preact/compat";
import {
  useContext,
  useEffect,
  useErrorBoundary,
  useRef,
  useState,
} from "preact/hooks";

import { COMPLETED, FAILED, RUNNING } from "../../action/action_run_states.js";
import { usePromise } from "./use_promise.js";

export const useAsyncData = (promiseOrAction) => {
  const isAction = Boolean(promiseOrAction && promiseOrAction.isAction);
  if (isAction) {
    return useAction(promiseOrAction);
  }
  return usePromise(promiseOrAction);
};

// ─── useAction ────────────────────────────────────────────────────────────────

const LoadingContext = createContext(null);
const actionPendingPromiseWeakMap = new WeakMap();
const dismissedActionWeakSet = new WeakSet();

const useAction = (action) => {
  const loadingRef = useContext(LoadingContext);
  // Use peek() instead of .value to avoid subscribing this component to the signal.
  // Reading .value would make Preact re-render the component reactively when the state
  // changes. When the action fails while Suspense is still holding the detached stale
  // DOM, this reactive re-render causes Suspense to move that stale DOM permanently
  // back into the document — the stale content then coexists with the error fallback
  // and never goes away. Manual subscription via useEffect + useState ensures
  // re-renders only happen after the pending promise resolves, at which point Suspense
  // has already processed the settlement and the detached DOM is discarded.
  const runningState = action.runningStateSignal.peek();

  const [, setTick] = useState(0);
  useEffect(() => {
    return action.runningStateSignal.subscribe(() => {
      setTick((n) => n + 1);
    });
  }, []);

  if (runningState === COMPLETED) {
    return action.dataSignal.peek();
  }
  if (runningState === FAILED) {
    if (dismissedActionWeakSet.has(action)) {
      const staleData = action.dataSignal.peek();
      if (staleData !== undefined) {
        // Dismissed with stale data — return it so children render normally
        return staleData;
      }
      // Dismissed with no data — fall through to suspend (LoadingFallback returns null)
    } else {
      const error = action.errorSignal.peek();
      error.action = action;
      throw error;
    }
  }

  // IDLE (no data) or RUNNING — suspend
  const reason = runningState === RUNNING ? "loading" : "idle";
  loadingRef.current = { reason, action };

  let pendingPromise = actionPendingPromiseWeakMap.get(action);
  if (!pendingPromise) {
    pendingPromise = new Promise((resolve) => {
      const unsubscribe = action.runningStateSignal.subscribe((state) => {
        if (state === RUNNING) {
          // Action re-ran — clear dismissed state regardless of path
          dismissedActionWeakSet.delete(action);
        }
        if (state === COMPLETED || state === FAILED) {
          actionPendingPromiseWeakMap.delete(action);
          unsubscribe();
          resolve();
        } else if (reason === "idle" && state === RUNNING) {
          // idle→running: unblock so loadingRef reason updates to "loading"
          actionPendingPromiseWeakMap.delete(action);
          unsubscribe();
          resolve();
        }
      });
    });
    actionPendingPromiseWeakMap.set(action, pendingPromise);
  }
  throw pendingPromise;
};

// ─── Loading ──────────────────────────────────────────────────────────────────
// Wraps Suspense. Provides LoadingContext so useAction can write the suspension
// reason. LoadingFallback reads that reason and subscribes to the action so it
// only shows the spinner when actually loading (not in the initial idle state).

const LoadingFallback = ({ loadingRef, fallback }) => {
  const [, setTick] = useState(0);
  const { action } = loadingRef.current;
  useEffect(() => {
    if (!action) {
      return undefined;
    }
    return action.runningStateSignal.subscribe(() => {
      setTick((n) => n + 1);
    });
  }, [action]);
  if (loadingRef.current.reason === "loading") {
    return fallback;
  }
  return null;
};

export const Loading = ({ children, fallback }) => {
  const loadingRef = useRef({ reason: "idle", action: null });
  if (!fallback) {
    // No fallback — children handle loading state via { loading } from useAsyncData
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

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
// Catches errors thrown by useAction. Subscribes to error.action so it
// auto-resets when the action runs again.

export const ErrorBoundary = ({ children, fallback, onReset }) => {
  const [error, resetError] = useErrorBoundary();
  const [dismissed, setDismissed] = useState(false);
  const dismissedActionRef = useRef(null);

  useEffect(() => {
    if (!error) {
      return undefined;
    }
    setDismissed(false); // new error — show fallback
    const action = error.action;
    if (!action) {
      return undefined;
    }
    return action.runningStateSignal.subscribe((state) => {
      if (state === RUNNING) {
        dismissedActionWeakSet.delete(action);
        dismissedActionRef.current = null;
        setDismissed(false);
        resetError();
      }
    });
  }, [error]);

  if (error && !dismissed) {
    error.__handled_by__ = "<ErrorBoundary>"; // prevent jsenv from displaying it
    const action = error.action;
    const dismiss = () => {
      if (action) {
        dismissedActionWeakSet.add(action);
        dismissedActionRef.current = action;
      }
      onReset?.();
      setDismissed(true);
      resetError();
    };
    if (!fallback) {
      return null;
    }
    if (typeof fallback === "function") {
      return h(fallback, { error, resetError: dismiss });
    }
    return fallback;
  }
  if (dismissed) {
    const action = dismissedActionRef.current;
    const hasStaleData = action && action.dataSignal.peek() !== undefined;
    if (!hasStaleData) {
      // No stale data — render nothing until action runs again
      return null;
    }
    // Has stale data — children will render via useAction returning stale value
  }
  return children;
};
