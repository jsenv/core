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
const useAction = (action) => {
  const loadingRef = useContext(LoadingContext);
  const runningState = action.runningStateSignal.value;

  if (runningState === COMPLETED) {
    return { data: action.dataSignal.peek(), loading: false };
  }
  if (runningState === FAILED) {
    if (!dismissedActionWeakSet.has(action)) {
      const error = action.errorSignal.peek();
      error.action = action;
      throw error;
    }
    const staleData = action.dataSignal.peek();
    if (staleData !== undefined) {
      // Error was dismissed with stale data — show last known data
      return { data: staleData, loading: false };
    }
    // Dismissed with no stale data — fall through to suspend as idle
  }

  // RUNNING, IDLE (no data), or FAILED-dismissed (no stale data)
  if (!loadingRef) {
    // No <Loading fallback> — component handles loading state
    return { data: undefined, loading: runningState === RUNNING };
  }

  // <Loading fallback> present — tell it which action is suspending, then throw
  loadingRef.current = { action };
  let pendingPromise = actionPendingPromiseWeakMap.get(action);
  if (!pendingPromise) {
    pendingPromise = new Promise((resolve) => {
      const unsubscribe = action.runningStateSignal.subscribe((state) => {
        if (state === COMPLETED || state === FAILED) {
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
// useAction writes { action } into this ref before throwing a promise,
// so LoadingFallback knows which action to subscribe to and whether to show the fallback.
const LoadingContext = createContext(null);
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

const actionPendingPromiseWeakMap = new WeakMap();
const dismissedActionWeakSet = new WeakSet();
const dismissAction = (action) => {
  dismissedActionWeakSet.add(action);
};
const undismissAction = (action) => {
  dismissedActionWeakSet.delete(action);
};

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
        undismissAction(action);
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
