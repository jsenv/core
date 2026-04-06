import { COMPLETED, FAILED, RUNNING } from "../action/action_run_states.js";
import { useHasErrorBoundary, useSilencedAction } from "./error_boundary.jsx";
import { useLoadingHasFallback } from "./loading.jsx";
import { useForceRender } from "./use_force_render.js";

export const useAsyncData = (promiseOrAction) => {
  const isAction = Boolean(promiseOrAction && promiseOrAction.isAction);
  if (isAction) {
    return useAction(promiseOrAction);
  }
  return usePromise(promiseOrAction);
};
const actionPendingPromiseWeakMap = new WeakMap();
const FALLBACK_LATEST_DATA = true;
const useAction = (action) => {
  const loadingFallback = useLoadingHasFallback();
  const hasErrorBoundary = useHasErrorBoundary();
  const silencedAction = useSilencedAction();
  const runningState = action.runningStateSignal.value;
  if (runningState === COMPLETED) {
    const data = action.dataSignal.peek();
    return { data, loading: false, error: undefined };
  }
  if (runningState === FAILED) {
    if (FALLBACK_LATEST_DATA && silencedAction === action) {
      // Error was dismissed — show last known data only if action completed once before
      const lastData = action.dataSignal.peek();
      if (lastData !== undefined) {
        return { data: lastData, loading: false, error: undefined };
      }
      // No previous data — fall through to throw so ErrorBoundary renders null
    }
    const error = action.errorSignal.peek();
    if (!hasErrorBoundary) {
      return { data: undefined, loading: false, error };
    }
    error.action = action;
    throw error;
  }
  // IDLE or RUNNING
  if (!loadingFallback) {
    // <Loading> has no fallback — return state, let component handle it
    return { data: undefined, loading: runningState === RUNNING };
  }
  // <Loading> has a fallback — suspend so Suspense shows the fallback
  let pendingPromise = actionPendingPromiseWeakMap.get(action);
  if (!pendingPromise) {
    let resolve;
    pendingPromise = new Promise((res) => {
      resolve = res;
    });
    actionPendingPromiseWeakMap.set(action, pendingPromise);
    const unsubscribe = action.runningStateSignal.subscribe((state) => {
      if (state === COMPLETED) {
        actionPendingPromiseWeakMap.delete(action);
        unsubscribe();
        resolve();
      } else if (state === FAILED) {
        actionPendingPromiseWeakMap.delete(action);
        unsubscribe();
        // Do NOT resolve the promise on FAILED: resolving would cause Suspense to commit children
        // (showing stale DOM briefly before the error throw reaches ErrorBoundary).
        // Instead, let signals re-render the component (it reads runningStateSignal.value, so it's
        // subscribed). That re-render throws the error directly to ErrorBoundary.
      }
    });
  }
  throw pendingPromise;
};
const promiseStateWeakMap = new WeakMap();
const usePromise = (promise) => {
  const forceRender = useForceRender();

  let promiseState = promiseStateWeakMap.get(promise);
  if (!promiseState) {
    promiseState = {
      data: null,
      error: null,
      settled: false,
    };
    promiseStateWeakMap.set(promise, promiseState);
    promise.then(
      (data) => {
        promiseState.data = data;
        promiseState.settled = true;
        forceRender();
      },
      (error) => {
        promiseState.error = error;
        promiseState.settled = true;
      },
    );
    throw promise;
  }
  if (!promiseState.settled) {
    throw promise;
  }
  if (promiseState.error) {
    throw promiseState.error;
  }
  return promiseState.data;
};
