// https://github.com/preactjs/preact/issues/4756

import { createContext, h } from "preact";
import { Suspense } from "preact/compat";
import {
  useContext,
  useEffect,
  useErrorBoundary,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import {
  markErrorAsDisplayedBy,
  markErrorAsTakenByRender,
} from "../../action/action_error_report.js";
import {
  COMPLETED,
  FAILED,
  IDLE,
  RUNNING,
} from "../../action/action_run_states.js";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { documentUrlSignal } from "../../nav/browser_integration/document_url_signal.js";
import { publishRouteRender } from "../../nav/route_render.js";
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
 * @param {{ loading?: true, error?: true, run?: true, onLoad?: (data: any, context: {params: any}) => void }} [options]
 * @param {true} [options.run] - The fallback for data nothing else can ask for:
 *   this component owns the request and starts it, from the render that reads
 *   it. `loading` and `error` keep their meaning — delegated by default,
 *   handled inline when asked for — so a run started here suspends into
 *   `<Loading>` like any other.
 *
 *   Prefer a `routeAction` wherever the parameter is one the address holds (a
 *   path param, a search param bound to a `stateSignal`), popup included: it is
 *   asked for when the address changes, with everything else that address
 *   needs, whereas this one cannot start before the component that draws it
 *   exists — one render late, and behind whatever gesture mounted it. What is
 *   left for `run` is the parameter chosen inside the component and dying with
 *   it (see docs/actions.md and docs/popup_open.md).
 * @param {(data: any, context: {params: any}) => void} [options.onLoad] - what
 *   this screen does with the data ONCE, when it becomes known: seed the fields
 *   someone is about to edit, remember where a list was, focus something.
 *
 *   Fired once per set of params — never again for a rerun that brings the same
 *   thing back. That is the whole point of it: a save, a refresh, a poll all
 *   hand the data over again, and copying it a second time would overwrite what
 *   the person is in the middle of writing. The action knows what it ran with,
 *   so nobody has to guess the dependency.
 *
 *   Called from a layout effect, so what it writes belongs to the same tick as
 *   the render that got the data — a `<Form pristineKey>` taking its reference
 *   then sees the filled fields rather than the empty ones.
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
  { loading = "delegate", error = "delegate", run, onLoad } = {},
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
      run,
      onLoad,
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

const useActionAsyncData = (
  action,
  { loadingEffect, errorEffect, run, onLoad },
) => {
  const loadingRef = useContext(LoadingContext);
  if (!loadingRef) {
    throw new Error(
      `Missing <Loading>: useAsyncData delegates the wait, so it needs a <Loading> boundary above it — or "loading: true" to draw that wait here.`,
    );
  }
  useOnLoad(action, onLoad);

  // `run: true` — this component owns the request, so it is what starts it, and
  // it starts it from the render rather than from an effect: a component that
  // suspends has no effects, so a run written in one would be waiting for
  // itself. Asking twice costs nothing — a running or completed action is a
  // no-op — which is what makes starting it while rendering sound. From there
  // the wait is the ordinary one: suspended into <Loading>, or drawn by the
  // component under `loading: true`, exactly as for data someone else ran.
  if (
    run &&
    action.runningStateSignal.peek() === IDLE &&
    action.paramsSignal.peek() !== undefined
  ) {
    const runResult = action.run({ reason: "useAsyncData({ run: true })" });
    // Nobody awaits this run, and a rejection nobody awaits is an unhandled
    // one — in dev, an overlay over a component already saying what failed.
    // The failure is held by the action, and this hook is what reads it.
    if (runResult && typeof runResult.catch === "function") {
      runResult.catch(() => {});
    }
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
    const unsubscribeFromRunningState = action.runningStateSignal.subscribe(
      (state) => {
        if (state === RUNNING) {
          dismissedActionWeakSet.delete(action);
        }
        setTick((n) => n + 1);
      },
    );
    // The data does not come from this action's runs alone: dataSignal is a
    // computed over the resource store, so an other action writing that store
    // (a PUT upserting an item that a GET_MANY list already holds) changes the
    // data while this action stays COMPLETED. Subscribing here re-renders
    // through the same controlled path as the run state, instead of `.value`.
    let dataNotificationIsInitial = true;
    const unsubscribeFromData = action.dataSignal.subscribe(() => {
      if (dataNotificationIsInitial) {
        // subscribe() calls back synchronously with the current value
        dataNotificationIsInitial = false;
        return;
      }
      setTick((n) => n + 1);
    });
    return () => {
      unsubscribeFromRunningState();
      unsubscribeFromData();
    };
    // Bound to the action, not to the mount: params given as a plain object
    // make another action instance, and the component would otherwise stay
    // subscribed to the state of the one it no longer reads.
  }, [action]);

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
    // A render has it now, whichever way it goes from here (see
    // action_error_report.js): displayed below, or thrown to a boundary that
    // displays it — and if none does, the throw reaches window on its own.
    markErrorAsTakenByRender(actionError);
    if (errorEffect === "use") {
      // Handed to the component, which is what displays it from here on
      // (see action_error_report.js)
      markErrorAsDisplayedBy(actionError, "useAsyncData({ error: true })");
      const dismissError = () => {
        dismissedActionWeakSet.add(action);
        setTick((n) => n + 1);
      };
      return [undefined, false, actionError, dismissError];
    }
    // Not marked: nothing is displayed yet — the boundary that catches this is
    // what says so, and only if it has something to show.
    throw actionError;
  }

  // RUNNING with loadingEffect: "use" — return stale data + loading flag, no suspend
  if (loadingEffect === "use" && runningState === RUNNING) {
    const staleData = action.dataSignal.peek();
    return [staleData, true, undefined];
  }

  // An action without params has nothing to run and no one to start it: this is
  // where a route action lands when its params getter returns false. It is not a
  // load in progress, so there is nothing to wait for — suspending here would
  // throw a promise that never settles, and the whole <Loading> subtree would
  // stay hidden for good, silently.
  if (runningState !== RUNNING && action.paramsSignal.peek() === undefined) {
    return [action.dataSignal.peek(), false, undefined];
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

// What a screen does with the data once, when it becomes known (see onLoad in
// the JSDoc above). Kept apart because the two questions it answers are not the
// ones the hook around it answers: WHEN — a layout effect, so a form taking its
// reference in the same tick sees what was written; and HOW OFTEN — once per set
// of params, which is the action's own answer to "is this another thing or the
// same one again".
const NOTHING_SEEDED = Symbol("nothing_seeded");
const useOnLoad = (action, onLoad) => {
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const paramsSeededRef = useRef(NOTHING_SEEDED);
  useLayoutEffect(() => {
    const callback = onLoadRef.current;
    if (!callback) {
      return;
    }
    if (action.runningStateSignal.peek() !== COMPLETED) {
      return;
    }
    const data = action.dataSignal.peek();
    if (data === undefined) {
      return;
    }
    const params = action.paramsSignal.peek();
    const paramsSeeded = paramsSeededRef.current;
    if (
      paramsSeeded !== NOTHING_SEEDED &&
      compareTwoJsValues(params, paramsSeeded)
    ) {
      return;
    }
    paramsSeededRef.current = params;
    callback(data, { params });
  });
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
  // A page that suspends never gets to say it is on screen — its own effects
  // are held with it — so this says it for it: what the document shows of the
  // page arriving is this. Anyone waiting for the page to be there before
  // moving (a travel about to have its picture taken, see route_travel.jsx)
  // would otherwise wait for a render that cannot happen until the data does.
  useLayoutEffect(() => {
    publishRouteRender();
  });
  if (loadingRef.current.reason !== "loading") {
    return null;
  }
  if (typeof fallback === "function") {
    return h(fallback);
  }
  return fallback;
};

// ─── ErrorBoundary ────────────────────────────────────────────────────────────
/**
 * Displays what its subtree throws — an action failure delegated by
 * `useAsyncData`, or any render error under it.
 *
 * Two things it gets right that a hand-written boundary rarely does, both
 * explained in docs/error_handling.md:
 *
 * - It marks the error as displayed ONLY when it actually displays it.
 *   `preact/debug` rethrows every error a boundary caught in a `setTimeout`, on
 *   purpose (React devtools compatibility), so a handled error still reaches
 *   window and the jsenv overlay covers the app unless `__handled_by__` is set.
 *   Setting it before knowing whether anything is rendered turns a boundary into
 *   a bug swallower: a TypeError in a component becomes a blank page AND a
 *   silent one. Without a `fallback` there is nothing to display, so the error is
 *   left alone and continues up.
 *
 * - It resets on navigation, not only on rerun. Rerunning the failed action is
 *   one way out; going somewhere else is the common one. Without a reset on the
 *   document URL, the error stays in place of every page after it, including the
 *   ones that would render fine.
 *
 * @param {object} props
 * @param {Function|import("preact").VNode} [props.fallback] - what is displayed
 *   instead of the children: an element, or a component receiving
 *   `{ error, resetError }`. Without it the boundary is transparent.
 * @param {() => void} [props.onReset] - called when the fallback dismisses the
 *   error via its `resetError`.
 */
export const ErrorBoundary = ({ children, fallback, onReset }) => {
  const [error, resetError] = useErrorBoundary();
  const [dismissed, setDismissed] = useState(false);
  const cleanupRef = useRef();

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  // The error belongs to the page that failed: leaving it means leaving it
  // behind.
  useEffect(() => {
    if (!error) {
      return undefined;
    }
    const documentUrlWhenCaught = documentUrlSignal.peek();
    return documentUrlSignal.subscribe((documentUrl) => {
      // subscribe() calls back synchronously with the current value
      if (documentUrl === documentUrlWhenCaught) {
        return;
      }
      setDismissed(false);
      resetError();
    });
  }, [error]);

  if (error) {
    if (!fallback) {
      // Nothing to display means nothing handled: rethrow untouched so the
      // error reaches whoever can do something with it (an outer boundary, or
      // the dev overlay).
      throw error;
    }

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
    markErrorAsDisplayedBy(error, "<ErrorBoundary>"); // displayed here, so nothing else has to
    if (typeof fallback === "function") {
      return h(fallback, { error, resetError: dismiss });
    }
    return fallback;
  }
  return children;
};
