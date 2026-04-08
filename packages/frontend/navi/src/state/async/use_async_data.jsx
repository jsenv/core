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
import { usePromiseAsyncData } from "./use_promise_async_data.js";

/**
 * Reads the current state of an action and returns `[data, loading, error]`.
 *
 * By default (`loading` and `error` not set) the component suspends on load
 * and throws on failure, delegating both states to the nearest `<Loading>` and
 * `<ErrorBoundary>` ancestors. Pass `loading: true` or `error: true` to handle
 * either state directly inside the component instead.
 *
 * Return value: `[data, loading, error]`
 * - `data`    — the action's last successful data, or `undefined` if it has never completed
 * - `loading` — `true` while the action is running (only when `loading: true` is passed)
 * - `error`   — the Error thrown by the action (only when `error: true` is passed)
 *
 * Stale data is always returned: when an action re-runs, the previous `data`
 * remains available so the component can keep showing stale content while the
 * refresh is in progress. Whether to show `data` or a loading indicator when
 * `loading` is `true` is entirely up to the component.
 *
 * When `loading` is not set (default), the component suspends until data is
 * ready, so `data` is always defined when the component renders and `loading`
 * is always `false`.
 *
 * When `error` is not set (default), any action failure causes the component
 * to throw, so `error` is always `undefined` when the component renders.
 *
 * @param {import("../../action/actions.js").Action} action
 * @param {{ loading?: true, error?: true }} [options]
 * @returns {[data: unknown, loading: boolean, error: Error | undefined, dismissError: (() => void) | undefined]}
 *
 * @example <caption>Default — delegate both states (least code)</caption>
 * const [user] = useAsyncData(userAction);
 * // user is always defined here — never loading, never error
 *
 * @example <caption>Handle loading inline while keeping stale data</caption>
 * const [user, loading] = useAsyncData(userAction, { loading: true });
 * // First load:   user === undefined, loading === true  → show skeleton
 * // While refreshing: user === <stale>, loading === true → show stale + spinner
 * // Done:         user === <fresh>,   loading === false
 *
 * @example <caption>Handle error inline</caption>
 * const [user, , error] = useAsyncData(userAction, { error: true });
 * if (error) return <ErrorCard message={error.message} />;
 */
export const useAsyncData = (
  promiseOrAction,
  { loading = "delegate", error = "delegate" } = {},
) => {
  const isAction = Boolean(promiseOrAction && promiseOrAction.isAction);
  if (loading === true) {
    loading = "use";
  }
  if (error === true) {
    error = "use";
  }
  if (isAction) {
    return useActionAsyncData(promiseOrAction, {
      loadingEffect: loading,
      errorEffect: error,
    });
  }
  return usePromiseAsyncData(promiseOrAction, {
    loadingEffect: loading,
    errorEffect: error,
  });
};

// ─── useAction ────────────────────────────────────────────────────────────────

const LoadingContext = createContext(null);
const actionPendingPromiseWeakMap = new WeakMap();
const dismissedActionWeakSet = new WeakSet();
const dismissedActionPendingPromiseWeakMap = new WeakMap();

const useActionAsyncData = (action, { loadingEffect, errorEffect }) => {
  const loadingRef = useContext(LoadingContext);
  if (!loadingRef) {
    throw new Error("Missing <Loading>");
  }

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
    return action.runningStateSignal.subscribe((state) => {
      if (state === RUNNING) {
        dismissedActionWeakSet.delete(action);
      }
      setTick((n) => n + 1);
    });
  }, []);

  if (runningState === COMPLETED) {
    return [action.dataSignal.peek(), false, undefined];
  }
  if (runningState === FAILED) {
    if (dismissedActionWeakSet.has(action)) {
      const staleData = action.dataSignal.peek();
      if (staleData !== undefined) {
        // Dismissed with stale data — return it so children render normally
        return [staleData, false, undefined];
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
    if (errorEffect === "use") {
      const dismissError = () => {
        dismissedActionWeakSet.add(action);
        setTick((n) => n + 1);
      };
      return [undefined, false, actionError, dismissError];
    }
    actionError.action = action;
    throw actionError;
  }

  // RUNNING with loadingEffect: "use" — return stale data + loading flag, no suspend
  if (loadingEffect === "use" && runningState === RUNNING) {
    const staleData = action.dataSignal.peek();
    return [staleData, true, undefined];
  }

  // IDLE or RUNNING with loadingEffect: "delegate" — suspend
  const reason = runningState === RUNNING ? "loading" : "idle";
  loadingRef.current = { reason, action };
  let pendingPromise = actionPendingPromiseWeakMap.get(action);
  if (!pendingPromise) {
    pendingPromise = new Promise((resolve) => {
      const unsubscribe = action.runningStateSignal.subscribe((state) => {
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
export const Loading = ({ children, fallback }) => {
  const loadingRef = useRef({ reason: "idle", action: null });
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
