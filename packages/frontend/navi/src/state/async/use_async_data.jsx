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

export const useAsyncData = (
  promiseOrAction,
  { loading = "delegate", error = "delegate" } = {},
) => {
  const isAction = Boolean(promiseOrAction && promiseOrAction.isAction);
  if (isAction) {
    return useAction(promiseOrAction, {
      loadingEffect: loading,
      errorEffect: error,
    });
  }
  return usePromise(promiseOrAction);
};

// ─── useAction ────────────────────────────────────────────────────────────────

const LoadingContext = createContext(null);
const actionPendingPromiseWeakMap = new WeakMap();
const dismissedActionWeakSet = new WeakSet();
const dismissedActionPendingPromiseWeakMap = new WeakMap();

const useAction = (action, { loadingEffect, errorEffect }) => {
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
    return {
      loading: false,
      error: null,
      data: action.dataSignal.peek(),
    };
  }
  if (runningState === FAILED) {
    if (dismissedActionWeakSet.has(action)) {
      const staleData = action.dataSignal.peek();
      if (staleData !== undefined) {
        // Dismissed with stale data — return it so children render normally
        return {
          loading: false,
          error: null,
          data: staleData,
        };
      }
      // Dismissed with no data — suspend until the action re-runs.
      // A never-resolving promise would leave the component stuck forever,
      // so we use an action-specific promise that resolves on RUNNING,
      // which lets the component re-render and go through the normal loading path.
      let dismissedPromise = dismissedActionPendingPromiseWeakMap.get(action);
      if (!dismissedPromise) {
        dismissedPromise = new Promise((resolve) => {
          const unsubscribe = action.runningStateSignal.subscribe((state) => {
            if (state === RUNNING) {
              dismissedActionPendingPromiseWeakMap.delete(action);
              unsubscribe();
              resolve();
            }
          });
        });
        dismissedActionPendingPromiseWeakMap.set(action, dismissedPromise);
      }
      throw dismissedPromise;
    }
    const actionError = action.errorSignal.peek();
    if (errorEffect === "internal") {
      return {
        loading: false,
        error: actionError,
        data: undefined,
      };
    }
    actionError.action = action;
    throw actionError;
  }

  // RUNNING with previous data and loading: "preserve"
  if (runningState === RUNNING) {
    if (loadingEffect === "preserve") {
      const staleData = action.dataSignal.peek();
      if (staleData !== undefined) {
        return {
          loading: true,
          error: null,
          data: staleData,
        };
      }
    }
    // RUNNING with loading: "internal" — return loading flag without suspending
    if (loadingEffect === "internal") {
      return {
        loading: true,
        error: null,
        data: undefined,
      };
    }
  }

  // IDLE or RUNNING with loadingEffect: "delegate" — suspend
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
  if (loadingRef.current.reason !== "loading") {
    return null;
  }
  if (typeof fallback === "function") {
    return h(fallback);
  }
  return fallback;
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
  const cleanupRef = useRef();

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  if (error) {
    error.__handled_by__ = "<ErrorBoundary>"; // prevent jsenv from displaying it

    const action = error.action;
    if (action) {
      cleanupRef.current?.();
      cleanupRef.current = action.runningStateSignal.subscribe((state) => {
        if (state === RUNNING) {
          dismissedActionWeakSet.delete(action);
          setDismissed(false);
          resetError();
        }
      });

      const hasStaleData = action && action.dataSignal.peek() !== undefined;
      if (dismissed) {
        if (hasStaleData) {
          // Has stale data — children will render (useAction returns stale value)
          return children;
        }
      }
    } else if (dismissed) {
      // stop rendering the error
      return null;
    }
    const dismiss = () => {
      if (action) {
        dismissedActionWeakSet.add(action);
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
  return children;
};
