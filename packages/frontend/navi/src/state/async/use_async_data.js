// https://github.com/preactjs/preact/issues/4756

import { useContext } from "preact/hooks";
import { COMPLETED, FAILED, RUNNING } from "../../action/action_run_states.js";
import { LoadingContext } from "./loading.jsx";
import { usePromise } from "./use_promise.js";

export const useAsyncData = (promiseOrAction) => {
  const isAction = Boolean(promiseOrAction && promiseOrAction.isAction);
  if (isAction) {
    return useAction(promiseOrAction);
  }
  return usePromise(promiseOrAction);
};

const actionPendingPromiseWeakMap = new WeakMap();
const dismissedActionWeakSet = new WeakSet();

// Called by ErrorBoundary when user dismisses an error that has stale data.
// Keeps action in FAILED state but tells useAction to return the stale data instead of throwing.
export const dismissAction = (action) => {
  dismissedActionWeakSet.add(action);
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
    const isIdle = runningState !== RUNNING;
    pendingPromise = new Promise((resolve) => {
      const unsubscribe = action.runningStateSignal.subscribe((state) => {
        if (isIdle) {
          // Waiting for action to start running so LoadingFallback can show the spinner
          if (state === RUNNING) {
            actionPendingPromiseWeakMap.delete(action);
            unsubscribe();
            resolve();
          }
        }
        // Running — waiting for it to settle
        else if (state === COMPLETED || state === FAILED) {
          dismissedActionWeakSet.delete(action);
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
