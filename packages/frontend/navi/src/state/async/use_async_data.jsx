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
  const runningState = action.runningStateSignal.peek();
  console.debug(`useAction(${action.name}): render state=${runningState.id}`);

  if (runningState === FAILED) {
    const staleData = action.dataSignal.peek();
    if (staleData !== undefined) {
      console.debug(
        `useAction(${action.name}): -> return stale data (dismissed)`,
      );
      return staleData;
    }
    console.debug(
      `useAction(${action.name}): -> FAILED+dismissed, no stale data, fall through to suspend`,
    );
    const error = action.errorSignal.peek();
    error.action = action;
    throw error;
  }
  if (runningState === COMPLETED) {
    console.debug(`useAction(${action.name}): -> return data`);
    return action.dataSignal.peek();
  }

  // <Loading fallback> present — tell it which action is suspending, then throw
  loadingRef.current = { action };
  let pendingPromise = actionPendingPromiseWeakMap.get(action);
  if (!pendingPromise) {
    pendingPromise = new Promise((resolve) => {
      const unsubscribe = action.runningStateSignal.subscribe((state) => {
        console.debug(
          `useAction(${action.name}): pendingPromise subscription fired state=${state.id}`,
        );
        if (state === COMPLETED || state === FAILED) {
          actionPendingPromiseWeakMap.delete(action);
          unsubscribe();
          resolve();
          // here if the action re-runs, we should re-subscribe
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

export const ErrorBoundary = ({ children, fallback }) => {
  const [error, resetErrorInternal] = useErrorBoundary();
  const unsubscribeRef = useRef(null);
  const [key, setKey] = useState(0);

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
        setKey((k) => k + 1);
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
  }
  return (
    <ErrorRenderer key={key} error={error} fallback={fallback}>
      {children}
    </ErrorRenderer>
  );
};

const ErrorRenderer = ({ error, children, fallback }) => {
  if (error) {
    if (typeof fallback === "function") {
      return h(fallback, { error });
    }
    return fallback;
  }
  return children;
};
