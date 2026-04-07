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
  console.debug(`useAction(${action.name}): render state=${runningState.id}`);

  if (runningState === COMPLETED) {
    console.debug(`useAction(${action.name}): -> return data`);
    return { data: action.dataSignal.peek(), loading: false };
  }
  if (runningState === FAILED) {
    if (!dismissedActionWeakSet.has(action)) {
      console.debug(`useAction(${action.name}): -> throw error`);
      const error = action.errorSignal.peek();
      error.action = action;
      throw error;
    }
    const staleData = action.dataSignal.peek();
    if (staleData !== undefined) {
      console.debug(
        `useAction(${action.name}): -> return stale data (dismissed)`,
      );
      return { data: staleData, loading: false };
    }
    console.debug(
      `useAction(${action.name}): -> FAILED+dismissed, no stale data, fall through to suspend`,
    );
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
    pendingPromise = new Promise((resolve, reject) => {
      const unsubscribe = action.runningStateSignal.subscribe((state) => {
        console.debug(
          `useAction(${action.name}): pendingPromise subscription fired state=${state.id}`,
        );
        if (state === COMPLETED) {
          actionPendingPromiseWeakMap.delete(action);
          unsubscribe();
          resolve();
        } else if (state === FAILED) {
          // Reject so Suspense forwards the error directly to ErrorBoundary
          // without transitioning to children (which would flash stale DOM)
          actionPendingPromiseWeakMap.delete(action);
          unsubscribe();
          const error = action.errorSignal.peek();
          error.action = action;
          reject(error);
        }
      });
    });
    actionPendingPromiseWeakMap.set(action, pendingPromise);
  }
  console.debug(`useAction(${action.name}): -> throw pendingPromise`);
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
  const shouldDisplayFallback =
    !currentAction || currentAction.runningStateSignal.peek() === RUNNING;
  console.debug(
    `LoadingFallback render: action=${currentAction?.name ?? null} state=${currentAction?.runningStateSignal.peek().id ?? null} shouldDisplayFallback=${shouldDisplayFallback}`,
  );
  if (shouldDisplayFallback) {
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
    console.debug(`ErrorBoundary render: has error "${error.message}"`);
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
  console.debug(`ErrorBoundary render: no error, rendering children`);
  return children;
};
