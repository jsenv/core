import { createIterableWeakSet } from "@jsenv/dom";
import { prefixFirstAndIndentRemainingLines } from "@jsenv/humanize";
import { batch, computed, effect, signal } from "@preact/signals";

import { getDebouncedSignal } from "../state/debounce_signal.js";
import { isSignal } from "../utils/is_signal.js";
import { createJsValueWeakMap } from "../utils/js_value_weak_map.js";
import { mergeTwoJsValues } from "../utils/merge_two_js_values.js";
import { stringifyForDisplay } from "../utils/stringify_for_display.js";
import { weakEffect } from "../utils/weak_effect.js";
import {
  getActionPrivateProperties,
  setActionPrivateProperties,
} from "./action_private_properties.js";
import {
  ABORTED,
  COMPLETED,
  FAILED,
  IDLE,
  RUNNING,
} from "./action_run_states.js";
import { markErrorAsDisplayedBy } from "./action_error_report.js";
import { isRerunHeldByNetworkPolicy } from "./network_policy.js";
import { SYMBOL_OBJECT_SIGNAL } from "./symbol_object_signal.js";

/*
 * Actions: async callbacks wrapped in reactive state.
 *
 * An action owns a set of signals (params, runningState, error, value, data)
 * and moves through IDLE → RUNNING → COMPLETED / FAILED / ABORTED (see
 * action_run_states.js). `createAction(callback)` returns the root action;
 * `.bindParams(params)` derives child actions (one per params value, cached),
 * and binding a signal (or an object containing signals) returns an action
 * *proxy* that retargets itself to the right child action as the signal
 * changes (see createActionProxyFromSignal).
 *
 * How things run: prerun/run/rerun/reset never execute the action directly —
 * they go through `dispatchActions`, which the navigation integration can
 * replace via `setActionDispatcher` so that every action update participates
 * in the browser navigation lifecycle (abort signals, navigation events).
 * The default dispatcher calls `updateActions`, the single entry point that
 * resolves priorities between the four operation sets (reset > rerun > run >
 * prerun) and performs them.
 *
 * Memory design (the surprising part): nothing here keeps actions alive.
 * Child actions are held through ephemerons (createJsValueWeakMap) so a child
 * and its params are garbage-collected together, running actions live in
 * iterable *weak* sets, and property/signal mirroring uses weakEffect. Two
 * consequences to be aware of:
 * - an action can exist in several places only if everyone shares the same
 *   instance (the caches above are what makes lookups return it);
 * - prerun actions may have no other reference yet, so
 *   prerunProtectionRegistry pins them for a few minutes.
 *
 * A failing run rejects, and writes its error into errorSignal as well. The
 * callers that cannot take a rejection — a run started from a signal effect, a
 * control that already draws the failure — swallow it where they start it, and
 * that is where an error nobody displayed is reported once, by one rule (see
 * run_unwatched.js and action_error_report.js).
 *
 * Blast radius: this file is the substrate of routing (route_action.js,
 * action_run_effect.js), resources (state/rest) and every control's `action`
 * prop. Its own unit tests cover almost none of that, so a change here is
 * verified against the consumers' nets: tests/route_tabs and
 * tests/route_transition_list_revisit (browser), src/state/rest/tests and
 * src/nav/tests (node) — src/action/*.test.js alone proves nothing about
 * routing or lists.
 */

// Params waiting to settle exist only under a debounced binding; every other
// action answers "no" so nobody has to check whether it can be asked.
const NOT_SETTLING_SIGNAL = signal(false);

let DEBUG = false;
export const enableDebugActions = () => {
  DEBUG = true;
};

let dispatchActions = (params) => {
  const { requestedResult } = updateActions({
    globalAbortSignal: new AbortController().signal,
    abortSignal: new AbortController().signal,
    ...params,
  });
  return requestedResult;
};

const dispatchSingleAction = (action, method, options) => {
  const requestedResult = dispatchActions({
    prerunSet: method === "prerun" ? new Set([action]) : undefined,
    runSet: method === "run" ? new Set([action]) : undefined,
    rerunSet: method === "rerun" ? new Set([action]) : undefined,
    resetSet: method === "reset" ? new Set([action]) : undefined,
    ...options,
  });
  if (requestedResult && typeof requestedResult.then === "function") {
    return requestedResult.then((resolvedResult) =>
      resolvedResult ? resolvedResult[0] : undefined,
    );
  }
  return requestedResult ? requestedResult[0] : undefined;
};
export const setActionDispatcher = (value) => {
  dispatchActions = value;
};

export const getActionDispatcher = () => dispatchActions;

export const rerunActions = async (actionSet, options) => {
  return dispatchActions({
    rerunSet: actionSet,
    reason: "rerunActions was called",
    ...options,
  });
};

export const resetActions = async (actionSet, options) => {
  return dispatchActions({
    resetSet: actionSet,
    reason: "resetActions was called",
    ...options,
  });
};
export const abortRunningActions = (
  reason = "abortRunningActions was called",
) => {
  const { runningSet } = getActivationInfo();
  for (const runningAction of runningSet) {
    runningAction.abort(reason);
  }
};

/**
 * Registry that prevents prerun actions from being garbage collected.
 *
 * When an action is prerun, it might not have any active references yet
 * (e.g., the component that will use it hasn't loaded yet due to dynamic imports).
 * This registry keeps a reference to prerun actions for a configurable duration
 * to ensure they remain available when needed.
 *
 * Actions are automatically unprotected when:
 * - The protection duration expires (default: 5 minutes)
 * - The action is explicitly stopped via .reset()
 */
const prerunProtectionRegistry = (() => {
  const protectedActionMap = new Map(); // action -> { timeoutId, timestamp }
  const PROTECTION_DURATION = 5 * 60 * 1000; // 5 minutes

  const unprotect = (action) => {
    const protection = protectedActionMap.get(action);
    if (protection) {
      clearTimeout(protection.timeoutId);
      protectedActionMap.delete(action);
      const elapsed = Date.now() - protection.timestamp;
      action.debug(`"${action}": GC protection removed after ${elapsed}ms`);
    }
  };

  return {
    protect(action) {
      // already protected: extend the protection
      if (protectedActionMap.has(action)) {
        const existing = protectedActionMap.get(action);
        clearTimeout(existing.timeoutId);
      }

      const timestamp = Date.now();
      const timeoutId = setTimeout(() => {
        unprotect(action);
        action.debug(
          `"${action}": prerun protection expired after ${PROTECTION_DURATION}ms`,
        );
      }, PROTECTION_DURATION);
      protectedActionMap.set(action, { timeoutId, timestamp });
      action.debug(
        `"${action}": protected from GC for ${PROTECTION_DURATION}ms`,
      );
    },

    unprotect,
  };
})();

const formatActionSet = (actionSet, prefix = "") => {
  let message = prefix;
  for (const action of actionSet) {
    message += "\n";
    message += prefixFirstAndIndentRemainingLines(String(action), {
      prefix: "  -",
    });
  }
  return message;
};

const actionAbortMap = new Map();
const actionPromiseMap = new Map();
const activationWeakSet = createIterableWeakSet("activation");

const getActivationInfo = () => {
  const runningSet = new Set();
  const settledSet = new Set();

  for (const action of activationWeakSet) {
    const runningState = action.runningStateSignal.peek();

    if (runningState === RUNNING) {
      runningSet.add(action);
    } else if (
      runningState === COMPLETED ||
      runningState === FAILED ||
      runningState === ABORTED
    ) {
      settledSet.add(action);
    } else {
      throw new Error(
        `An action in the activation weak set must be RUNNING, ABORTED, FAILED or COMPLETED, found "${runningState.id}" for action "${action}"`,
      );
    }
  }

  return {
    runningSet,
    settledSet,
  };
};

if (import.meta.dev) {
  window.__actions__ = {
    activationWeakSet,
    getActivationInfo,
    inspectActivations: () => {
      const activations = [];
      for (const action of activationWeakSet) {
        activations.push({
          name: action.name,
          runningState: action.runningState.id,
          error: action.error,
          data: action.data,
          params: action.params,
          isProxy: action.isProxy || false,
        });
      }
      console.table(activations);
      return activations;
    },
    cleanup: {
      activation: {
        forceCleanup: () => activationWeakSet.forceCleanup(),
        schedule: () => activationWeakSet.schedule(),
        getStats: () => activationWeakSet.getStats(),
      },
    },
  };
}

export const updateActions = ({
  globalAbortSignal,
  abortSignal,
  isReplace = false,
  reason,
  event,
  prerunSet = new Set(),
  runSet = new Set(),
  rerunSet = new Set(),
  resetSet = new Set(),
  abortSignalMap = new Map(),
  onComplete,
  onAbort,
  onError,
} = {}) => {
  /*
   * Action update flow:
   *
   * Input: 4 sets of requested operations
   * - prerunSet: actions to prerun (background, low priority)
   * - runSet: actions to run (user-visible, medium priority)
   * - rerunSet: actions to force rerun (highest priority)
   * - resetSet: actions to reset/clear
   *
   * Priority resolution:
   * - reset always wins (explicit cleanup)
   * - rerun > run > prerun (rerun forces refresh even if already running)
   * - An action in multiple sets triggers warnings in dev mode
   *
   * Output: Internal operation sets that track what will actually happen
   * - willResetSet: actions that will be reset/cleared
   * - willPrerunSet: actions that will be prerun
   * - willRunSet: actions that will be run
   * - willPromoteSet: prerun actions that become run-requested
   * - stays*Set: actions that remain in their current state
   */

  const { runningSet, settledSet } = getActivationInfo();

  // Warn about overlapping sets in development
  if (import.meta.dev) {
    const allSets = [
      { name: "prerun", set: prerunSet },
      { name: "run", set: runSet },
      { name: "rerun", set: rerunSet },
      { name: "reset", set: resetSet },
    ];

    for (let i = 0; i < allSets.length; i++) {
      for (let j = i + 1; j < allSets.length; j++) {
        const setA = allSets[i];
        const setB = allSets[j];
        for (const action of setA.set) {
          if (setB.set.has(action)) {
            console.warn(
              `Action "${action}" is found in both ${setA.name}Set and ${setB.name}Set. This may lead to unexpected behavior.`,
            );
          }
        }
      }
    }
  }

  if (DEBUG) {
    let argSource = `reason: ${JSON.stringify(reason)}`;
    if (isReplace) {
      argSource += `, isReplace: true`;
    }
    console.group(`updateActions({ ${argSource} })`);
    const lines = [
      ...(prerunSet.size ? [formatActionSet(prerunSet, "- prerun:")] : []),
      ...(runSet.size ? [formatActionSet(runSet, "- run:")] : []),
      ...(rerunSet.size ? [formatActionSet(rerunSet, "- rerun:")] : []),
      ...(resetSet.size ? [formatActionSet(resetSet, "- reset:")] : []),
    ];
    console.debug(
      `requested operations:
${lines.join("\n")}`,
    );
  }

  // Internal sets that track what operations will actually be performed
  const willResetSet = new Set();
  const willPrerunSet = new Set();
  const willRunSet = new Set();
  const willPromoteSet = new Set(); // prerun -> run requested
  const staysRunningSet = new Set();
  const staysAbortedSet = new Set();
  const staysFailedSet = new Set();
  const staysCompletedSet = new Set();

  // Step 1: Determine which actions will be reset
  collect_actions_to_reset: {
    for (const actionToReset of resetSet) {
      if (actionToReset.runningState !== IDLE) {
        willResetSet.add(actionToReset);
      }
    }
  }

  // Step 2: Process prerun, run, and rerun sets
  collect_actions_to_prerun_and_run: {
    const handleActionRequest = (
      action,
      requestType, // "prerun", "run", or "rerun"
    ) => {
      const isPrerun = requestType === "prerun";
      const isRerun = requestType === "rerun";

      if (
        isRerun &&
        action.runningState === COMPLETED &&
        !willResetSet.has(action) &&
        isRerunHeldByNetworkPolicy(action)
      ) {
        // A completed read is the answer under a network policy: rerunning it
        // would only ask the network again (see network_policy.js).
        action.debug(
          `"${action}": rerun held by the network policy, stays completed`,
        );
        return;
      }
      if (
        action.runningState === RUNNING ||
        action.runningState === COMPLETED
      ) {
        // Action is already running/completed
        // By default, we don't interfere with already active actions
        // Unless it's a rerun or the action is also being reset
        if (isRerun || willResetSet.has(action)) {
          // Force reset first, then rerun/run
          willResetSet.add(action);
          if (isPrerun) {
            willPrerunSet.add(action);
          } else {
            willRunSet.add(action);
          }
        }
        // Otherwise, ignore the request (action stays as-is)
      } else if (isPrerun) {
        willPrerunSet.add(action);
      } else {
        willRunSet.add(action);
      }
    };

    // Process prerunSet (lowest priority)
    for (const actionToPrerun of prerunSet) {
      if (runSet.has(actionToPrerun) || rerunSet.has(actionToPrerun)) {
        // run/rerun wins over prerun - skip prerun
        continue;
      }
      handleActionRequest(actionToPrerun, "prerun");
    }

    // Process runSet (medium priority)
    for (const actionToRun of runSet) {
      if (rerunSet.has(actionToRun)) {
        // rerun wins over run - skip run
        continue;
      }
      if (actionToRun.isPrerun && actionToRun.runningState !== IDLE) {
        // Special case: action was prerun but not yet requested to run
        // Just promote it to "run requested" without rerunning
        willPromoteSet.add(actionToRun);
        continue;
      }
      handleActionRequest(actionToRun, "run");
    }

    // Process rerunSet (highest priority)
    for (const actionToRerun of rerunSet) {
      handleActionRequest(actionToRerun, "rerun");
    }
  }
  const allThenableArray = [];

  // Step 3: Determine which actions will stay in their current state
  collect_actions_that_stay: {
    for (const actionRunning of runningSet) {
      if (willResetSet.has(actionRunning)) {
        // will be reset (aborted), we don't want to wait
      } else if (
        willRunSet.has(actionRunning) ||
        willPrerunSet.has(actionRunning)
      ) {
        // will be run, we'll wait for the new run promise
      } else {
        // an action that was running and not affected by this update
        const actionPromise = actionPromiseMap.get(actionRunning);
        allThenableArray.push(actionPromise);
        staysRunningSet.add(actionRunning);
      }
    }
    for (const actionSettled of settledSet) {
      if (willResetSet.has(actionSettled)) {
        // will be reset
      } else if (actionSettled.runningState === ABORTED) {
        staysAbortedSet.add(actionSettled);
      } else if (actionSettled.runningState === FAILED) {
        staysFailedSet.add(actionSettled);
      } else {
        staysCompletedSet.add(actionSettled);
      }
    }
  }
  if (DEBUG) {
    const lines = [
      ...(willResetSet.size
        ? [formatActionSet(willResetSet, "- will reset:")]
        : []),
      ...(willPrerunSet.size
        ? [formatActionSet(willPrerunSet, "- will prerun:")]
        : []),
      ...(willPromoteSet.size
        ? [formatActionSet(willPromoteSet, "- will promote:")]
        : []),
      ...(willRunSet.size ? [formatActionSet(willRunSet, "- will run:")] : []),
      ...(staysRunningSet.size
        ? [formatActionSet(staysRunningSet, "- stays running:")]
        : []),
      ...(staysAbortedSet.size
        ? [formatActionSet(staysAbortedSet, "- stays aborted:")]
        : []),
      ...(staysFailedSet.size
        ? [formatActionSet(staysFailedSet, "- stays failed:")]
        : []),
      ...(staysCompletedSet.size
        ? [formatActionSet(staysCompletedSet, "- stays completed:")]
        : []),
    ];
    console.debug(`operations that will be performed:
${lines.join("\n")}`);
  }

  // Step 4: Execute resets
  execute_resets: {
    for (const actionToReset of willResetSet) {
      const actionToResetPrivateProperties =
        getActionPrivateProperties(actionToReset);
      actionToResetPrivateProperties.performReset({
        reason,
        event,
        willRunOrPrerun:
          willRunSet.has(actionToReset) || willPrerunSet.has(actionToReset),
      });
      activationWeakSet.delete(actionToReset);
    }
  }

  const resultArray = []; // Store results with their execution order
  let hasAsync = false;

  // Step 5: Execute preruns and runs
  execute_preruns_and_runs: {
    const onActionToRunOrPrerun = (actionToPrerunOrRun, isPrerun) => {
      if (import.meta.dev && actionToPrerunOrRun.isProxy) {
        // maybe remove this check once the API is stable because
        // nothing in the API should allow this to happen
        throw new Error(
          `Proxy should not be reach this point, use the underlying action instead`,
        );
      }
      const actionSpecificSignal = abortSignalMap.get(actionToPrerunOrRun);
      const effectiveSignal = actionSpecificSignal || abortSignal;

      const actionToRunPrivateProperties =
        getActionPrivateProperties(actionToPrerunOrRun);
      let performRunResult;
      try {
        performRunResult = actionToRunPrivateProperties.performRun({
          globalAbortSignal,
          abortSignal: effectiveSignal,
          reason,
          event,
          isPrerun,
          onComplete,
          onAbort,
          onError,
        });
      } catch (error) {
        // A synchronous callback that threw. Caught here so the update carries
        // on — the other actions of the same update have nothing to do with
        // this one — and given back further down to whoever asked for THIS
        // action, still as a throw.
        activationWeakSet.add(actionToPrerunOrRun);
        resultArray.push({ type: "sync_error", error });
        return;
      }
      activationWeakSet.add(actionToPrerunOrRun);

      if (performRunResult && typeof performRunResult.then === "function") {
        actionPromiseMap.set(actionToPrerunOrRun, performRunResult);
        allThenableArray.push(performRunResult);
        hasAsync = true;
        // Store async result with order info
        resultArray.push({
          type: "async",
          promise: performRunResult,
        });
      } else {
        // Store sync result with order info
        resultArray.push({
          type: "sync",
          result: performRunResult,
        });
      }
    };

    // Execute preruns
    for (const actionToPrerun of willPrerunSet) {
      onActionToRunOrPrerun(actionToPrerun, true);
    }

    // Execute runs
    for (const actionToRun of willRunSet) {
      onActionToRunOrPrerun(actionToRun, false);
    }

    // Execute promotions (prerun -> run requested)
    for (const actionToPromote of willPromoteSet) {
      actionToPromote.isPrerunSignal.value = false;
    }
  }
  if (DEBUG) {
    console.groupEnd();
  }

  // Calculate requestedResult based on the execution results
  let requestedResult;
  if (resultArray.length === 0) {
    requestedResult = null;
  } else if (hasAsync) {
    requestedResult = Promise.all(
      resultArray.map((item) => {
        if (item.type === "sync") {
          return item.result;
        }
        if (item.type === "sync_error") {
          return Promise.reject(item.error);
        }
        return item.promise;
      }),
    );
  } else {
    const itemFailed = resultArray.find((item) => item.type === "sync_error");
    if (itemFailed) {
      // Nothing of this update is left to do, so the failure can leave the way
      // it arrived: thrown, to the caller that asked for that action.
      throw itemFailed.error;
    }
    requestedResult = resultArray.map((item) => item.result);
  }

  // Settled rather than raced: a failure here is one outcome among several —
  // the other actions of the same update ran too, and "the update is over" must
  // not become "one of them failed". Waiting on this never rejects, which is
  // what lets a navigation be waited on (see via_navigation.js).
  const allResult = allThenableArray.length
    ? Promise.allSettled(allThenableArray)
    : null;
  const runningActionSet = new Set([...willPrerunSet, ...willRunSet]);
  return {
    requestedResult,
    allResult,
    runningActionSet,
  };
};

const NO_PARAMS = { __no_params__: true };
const mergeActionParams = (currentParams, newParams) => {
  // The order of these two checks is load-bearing. Checking `undefined` first
  // looks symmetric — "no new params, keep whatever is there, NO_PARAMS
  // included" — and breaks routing: merge(NO_PARAMS, undefined) must yield
  // `undefined` so the proxy targets a runnable child, because NO_PARAMS means
  // "no params yet, nothing to run" to _updateTarget and the run-effect
  // machinery. With NO_PARAMS kept, a route action bound to a not-yet-matching
  // route resolves to no target and the page renders nothing
  // (tests/route_tabs is the net that catches it).
  if (currentParams === NO_PARAMS) {
    return newParams;
  }
  if (newParams === undefined) {
    // Every control binds its action to its UI state signal; a control that carries
    // no value (a button) has an undefined one. It contributes no params, which must
    // not be confused with "the params are undefined" — the params bound by
    // bindParams stay in place.
    return currentParams;
  }
  return mergeTwoJsValues(currentParams, newParams);
};

const actionWeakMap = new WeakMap();
export const createAction = (callback, rootOptions = {}) => {
  const existing = actionWeakMap.get(callback);
  if (existing) {
    return existing;
  }

  let rootAction;

  const createActionCore = (options, { parentAction } = {}) => {
    let {
      name = callback.name || "anonymous",
      params,
      isPrerun = false,
      runningState = IDLE,
      aborted = false,
      error = null,
      value,
      resultToValue,
      valueToData,
      dataDefault,
      data = dataDefault,

      completed = false,
      renderLoadedAsync,
      sideEffect = () => {},
      meta = {},

      outputSignal,
      completeSideEffect,
    } = options;
    if (!Object.hasOwn(options, "params")) {
      // even undefined should be respected it's only when not provided at all we use default
      params = NO_PARAMS;
    }
    if (value === undefined && data !== undefined) {
      value = data;
    }

    const valueInitial = value;
    const paramsSignal = signal(params);
    const isPrerunSignal = signal(isPrerun);
    const runningStateSignal = signal(runningState);
    const errorSignal = signal(error);
    const valueSignal = signal(valueInitial);
    const dataSignal = valueToData
      ? computed(() => valueToData(valueSignal.value))
      : valueSignal;

    const prerun = (options) => {
      action.debug(`${action}.prerun(${stringifyForDisplay(options)})`);
      return dispatchSingleAction(action, "prerun", options);
    };
    /**
     * Requests the action's data. An action that is already RUNNING or
     * COMPLETED already has it, so the request is a no-op there: use `rerun()`
     * to force a fresh run ("refresh", "check now", any explicit user intent to
     * go back to the network).
     */
    const run = (options) => {
      action.debug(`${action}.run(${stringifyForDisplay(options)})`);
      return dispatchSingleAction(action, "run", options);
    };
    /** Resets the action and runs it again, whatever state it is in. */
    const rerun = (options) => {
      action.debug(`${action}.rerun(${stringifyForDisplay(options)})`);
      return dispatchSingleAction(action, "rerun", options);
    };
    /**
     * Stop the action completely - this will:
     * 1. Abort if it's currently running
     * 2. Reset action running signal to IDLE state
     * 3. Clean up any resources and side effects
     * 4. Reset data/error to initial value
     */
    const reset = (options) => {
      return dispatchSingleAction(action, "reset", options);
    };
    const abort = (reason) => {
      if (runningStateSignal.peek() !== RUNNING) {
        return false;
      }
      const actionAbort = actionAbortMap.get(action);
      if (!actionAbort) {
        return false;
      }
      action.debug(`"${action}".abort(${reason})`);
      actionAbort(reason);
      return true;
    };

    let action;

    const childActionWeakSet = createIterableWeakSet("child_action");
    /*
     * Ephemeron behavior is critical here: actions must keep params alive.
     * Without this, bindParams(params) could create a new action while code
     * still references the old action with GC'd params. This would cause:
     * - Duplicate actions in activationWeakSet (old + new)
     * - Cache misses when looking up existing actions
     * - Subtle bugs where different parts of code use different action instances
     * The ephemeron pattern ensures params and actions have synchronized lifetimes.
     */
    const childActionWeakMap = createJsValueWeakMap();
    const _bindParams = (newParamsOrSignal, options = {}) => {
      // Case 1: a signal → proxy that retargets as the signal changes
      if (isSignal(newParamsOrSignal)) {
        const combinedParamsSignal = computed(() => {
          const newParams = newParamsOrSignal.value;
          const result = mergeActionParams(params, newParams);
          return result;
        });
        return createActionProxyFromSignal(
          action,
          combinedParamsSignal,
          options,
        );
      }

      // Case 2: a plain object → child action, or proxy when it contains signals
      if (isPlainObject(newParamsOrSignal)) {
        const staticParams = {};
        const signalMap = new Map();

        const keyArray = Object.keys(newParamsOrSignal);
        for (const key of keyArray) {
          const value = newParamsOrSignal[key];
          if (isSignal(value)) {
            signalMap.set(key, value);
          } else {
            const objectSignal = value ? value[SYMBOL_OBJECT_SIGNAL] : null;
            if (objectSignal) {
              signalMap.set(key, objectSignal);
            } else {
              staticParams[key] = value;
            }
          }
        }

        if (signalMap.size === 0) {
          // no signals: plain static merge
          if (
            params === null ||
            typeof params !== "object" ||
            params === NO_PARAMS
          ) {
            return createChildAction({
              ...options,
              params: newParamsOrSignal,
            });
          }
          const combinedParams = mergeActionParams(params, newParamsOrSignal);
          if (combinedParams === params) {
            // Binding added nothing (mergeTwoJsValues returns the current
            // params by reference when the new ones change no key): equal
            // params must give the same instance, and the instance holding
            // these exact params is this action. A separate child here would
            // run with its own signals, invisible to whoever holds this one —
            // a <Button action={A}> runs through this path (its UI state
            // contributes no params), and useActionStatus(A) must see that run.
            return action;
          }
          return createChildAction({
            ...options,
            params: combinedParams,
          });
        }

        const combinedParamsSignal = computed(() => {
          const combinedParams = {};
          for (const key of keyArray) {
            const signalForThisKey = signalMap.get(key);
            if (signalForThisKey) {
              // eslint-disable-next-line signals/no-conditional-value-read
              combinedParams[key] = signalForThisKey.value;
            } else {
              combinedParams[key] = staticParams[key];
            }
          }
          return combinedParams;
        });
        return createActionProxyFromSignal(
          action,
          combinedParamsSignal,
          options,
        );
      }

      // Case 3: a primitive or non-plain object (DOM event, …) → child action
      return createChildAction({
        params: newParamsOrSignal,
        ...options,
      });
    };
    /**
     * The action instance for these params.
     *
     * @param {any} newParamsOrSignal - params, or a signal holding them (the
     *   result then retargets itself as the signal changes), or an object whose
     *   values may be signals.
     * @param {object} [options]
     * @param {number} [options.debounce] - milliseconds the params must stay
     *   stable before the instance follows them. What it buys is a screen that
     *   owns its params — a search box, a picker — asking one question instead
     *   of one per keystroke, without an effect: the binding IS the delay.
     *   Only for a signal; params that cannot change have nothing to settle.
     *   During the delay the instance is still the previous one, holding the
     *   previous answer — `paramsSettlingSignal` is what says a newer one is
     *   coming, and `useAsyncData(action, { loading: true })` reads it.
     *   The instance follows where the signal settles, never a value it only
     *   passed through: a signal back where it started before the delay elapses
     *   asks nothing.
     */
    const bindParams = (newParamsOrSignal, options = {}) => {
      const { debounce, ...optionsWithoutDebounce } = options;
      if (debounce) {
        if (!isSignal(newParamsOrSignal)) {
          console.warn(
            `bindParams({ debounce }) expects a signal, received ${typeof newParamsOrSignal}: params that cannot change have nothing to settle.`,
          );
        } else {
          // The delay lives in a signal derived from theirs, one per (signal,
          // delay): the cache below then keys on it like on any other signal,
          // so two call sites asking the same question with the same delay get
          // the one instance, and two different delays get two.
          const debouncedParamsSignal = getDebouncedSignal(
            newParamsOrSignal,
            debounce,
          );
          return bindParams(debouncedParamsSignal, {
            ...optionsWithoutDebounce,
            syncParams: debouncedParamsSignal.flush,
            paramsSettlingSignal: debouncedParamsSignal.settlingSignal,
          });
        }
      }
      const existingChildAction = childActionWeakMap.get(newParamsOrSignal);
      if (existingChildAction) {
        return existingChildAction;
      }
      const childAction = _bindParams(
        newParamsOrSignal,
        optionsWithoutDebounce,
      );
      childActionWeakMap.set(newParamsOrSignal, childAction);
      if (childAction !== action) {
        // binding that added nothing resolves to the action itself; it must
        // not enter its own child set or matchAllSelfOrDescendant would
        // traverse it forever (the cache above may still hold it: a plain
        // lookup, never traversed)
        childActionWeakSet.add(childAction);
      }

      return childAction;
    };

    const createChildAction = (childOptions) => {
      const childActionOptions = {
        ...rootOptions,
        ...childOptions,
        meta: {
          ...rootOptions.meta,
          ...childOptions.meta,
        },
      };
      const childAction = createActionCore(childActionOptions, {
        parentAction: action,
      });
      return childAction;
    };

    const matchAllSelfOrDescendant = (predicate, { includeProxies } = {}) => {
      const matches = [];

      const traverse = (currentAction) => {
        if (currentAction.isProxy && !includeProxies) {
          // proxy action should be ignored because the underlying action will be found anyway
          // and if we check the proxy action we'll end up with duplicates
          // (loading the proxy would load the action it proxies)
          // and as they are 2 different objects they would be added to the set
          return;
        }

        if (predicate(currentAction)) {
          matches.push(currentAction);
        }

        // Get child actions from the current action
        const currentActionPrivateProps =
          getActionPrivateProperties(currentAction);
        const childActionWeakSet = currentActionPrivateProps.childActionWeakSet;
        for (const childAction of childActionWeakSet) {
          traverse(childAction);
        }
      };

      traverse(action);
      return matches;
    };

    const actionNameSignal = signal(name);
    const actionCallSourceSignal = signal(
      generateActionCallSource(name, params),
    );

    // The action is a callable: `ACTION(params)` is `ACTION.bindParams(params).rerun()`
    action = function actionFunction(...args) {
      if (args.length === 0) {
        return action.rerun();
      }
      const boundAction = bindParams(...args);
      return boundAction.rerun();
    };
    Object.defineProperty(action, "name", {
      configurable: true,
      get() {
        return actionNameSignal.value;
      },
    });
    Object.defineProperty(action, "callSource", {
      configurable: true,
      get() {
        return actionCallSourceSignal.value;
      },
      set(v) {
        actionCallSourceSignal.value = v;
      },
    });
    // makes createAction(anAction) return the action itself
    actionWeakMap.set(action, action);

    // Assign all the action properties and methods to the function
    Object.assign(action, {
      isAction: true,
      callback,
      rootAction,
      parentAction,
      params,
      isPrerun,
      runningState,
      aborted,
      error,
      value,
      data,
      completed,
      prerun,
      run,
      rerun,
      reset,
      abort,
      bindParams,
      matchAllSelfOrDescendant,
      replaceParams: (newParams) => {
        const currentParams = paramsSignal.value;
        const nextParams = mergeActionParams(currentParams, newParams);
        if (nextParams === currentParams) {
          return false;
        }

        // Update the weak map BEFORE updating the signal
        // so that any code triggered by the signal update finds this action
        if (parentAction) {
          const parentActionPrivateProps =
            getActionPrivateProperties(parentAction);
          const parentChildActionWeakMap =
            parentActionPrivateProps.childActionWeakMap;
          parentChildActionWeakMap.delete(currentParams);
          parentChildActionWeakMap.set(nextParams, action);
        }

        params = nextParams;
        action.params = nextParams;
        action.callSource = generateActionCallSource(name, nextParams);
        paramsSignal.value = nextParams;
        return true;
      },
      toString: () => action.callSource,
      meta,
      debug: (...args) => {
        if (!meta.debug && !DEBUG) {
          return;
        }
        console.debug(...args);
      },

      paramsSignal,
      paramsSettlingSignal: NOT_SETTLING_SIGNAL,
      runningStateSignal,
      isPrerunSignal,
      valueSignal,
      dataSignal,
      errorSignal,
    });
    Object.preventExtensions(action);

    // Mirror signals into plain properties (action.error, action.data, …)
    // so non-reactive code can read them without subscribing.
    effects: {
      weakEffect([action], (actionRef) => {
        isPrerun = isPrerunSignal.value;
        actionRef.isPrerun = isPrerun;
      });
      weakEffect([action], (actionRef) => {
        runningState = runningStateSignal.value;
        actionRef.runningState = runningState;
        aborted = runningState === ABORTED;
        actionRef.aborted = aborted;
        completed = runningState === COMPLETED;
        actionRef.completed = completed;
      });
      weakEffect([action], (actionRef) => {
        error = errorSignal.value;
        actionRef.error = error;
      });
      weakEffect([action], (actionRef) => {
        value = valueSignal.value;
        data = dataSignal.value;
        actionRef.value = value;
        actionRef.data = data;
      });
    }

    private_properties: {
      const ui = {
        renderLoaded: null,
        renderLoadedAsync,
      };
      let sideEffectCleanup;
      let completeSideEffectCleanup;

      const performRun = (runParams) => {
        const {
          globalAbortSignal,
          abortSignal,
          reason,
          event,
          isPrerun,
          onComplete,
          onAbort,
          onError,
        } = runParams;

        if (isPrerun) {
          prerunProtectionRegistry.protect(action);
        }

        const internalAbortController = new AbortController();
        const internalAbortSignal = internalAbortController.signal;
        const abort = (abortReason) => {
          runningStateSignal.value = ABORTED;
          internalAbortController.abort(abortReason);
          actionAbortMap.delete(action);
          if (isPrerun && (globalAbortSignal.aborted || abortSignal.aborted)) {
            prerunProtectionRegistry.unprotect(action);
          }
          if (DEBUG) {
            console.log(`"${action}" aborted (reason: ${abortReason})`);
          }
        };

        const onAbortFromSpecific = () => {
          abort(abortSignal.reason);
        };
        const onAbortFromGlobal = () => {
          abort(globalAbortSignal.reason);
        };

        if (abortSignal) {
          abortSignal.addEventListener("abort", onAbortFromSpecific);
        }
        if (globalAbortSignal) {
          globalAbortSignal.addEventListener("abort", onAbortFromGlobal);
        }

        actionAbortMap.set(action, abort);

        batch(() => {
          runningStateSignal.value = RUNNING;
          if (!isPrerun) {
            isPrerunSignal.value = false;
          }
        });

        const args = [];
        args.push(params);
        args.push({
          reason,
          event,
          signal: internalAbortSignal,
          isPrerun,
          action,
        });
        const returnValue = sideEffect(...args);
        if (typeof returnValue === "function") {
          sideEffectCleanup = returnValue;
        }

        let runResult;
        let rejected = false;
        let rejectedValue;
        const onRunEnd = () => {
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbortFromSpecific);
          }
          if (globalAbortSignal) {
            globalAbortSignal.removeEventListener("abort", onAbortFromGlobal);
          }
          prerunProtectionRegistry.unprotect(action);
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          /*
           * Critical: dataEffect, onComplete and completeSideEffect must be batched together to prevent
           * UI inconsistencies. The dataEffect might modify shared state (e.g.,
           * deleting items from a store), and onLoad callbacks might trigger
           * dependent action state changes.
           *
           * Without batching, the UI could render with partially updated state:
           * - dataEffect deletes a resource from the store
           * - UI renders immediately and tries to display the deleted resource
           * - onLoad hasn't yet updated dependent actions to loading state
           *
           * Example: When deleting a resource, we need to both update the store
           * AND put the action that loaded that resource back into loading state
           * before the UI attempts to render the now-missing resource.
           */

          batch(() => {
            const value = resultToValue
              ? resultToValue(runResult, action)
              : runResult;
            errorSignal.value = undefined;
            valueSignal.value = value;
            runningStateSignal.value = COMPLETED;
            const data = dataSignal.value;
            if (outputSignal) {
              outputSignal.value = data;
            }
            onComplete?.(data, action);
            completeSideEffectCleanup = completeSideEffect?.(action);
          });
          if (DEBUG) {
            console.log(`"${action}": completed`);
          }
          const data = dataSignal.peek();
          return data;
        };
        const onRunError = (error) => {
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbortFromSpecific);
          }
          if (globalAbortSignal) {
            globalAbortSignal.removeEventListener("abort", onAbortFromGlobal);
          }
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          const isAbort =
            (internalAbortSignal.aborted &&
              error === internalAbortSignal.reason) ||
            error.name === "AbortError";
          if (isAbort) {
            runningStateSignal.value = ABORTED;
            if (isPrerun && abortSignal.aborted) {
              prerunProtectionRegistry.unprotect(action);
            }
            onAbort?.(error, { event, action, args });
            return error;
          }
          if (DEBUG) {
            console.log(`"${action}": failed (error: ${error})`);
          }
          error.action = action;
          batch(() => {
            errorSignal.value = error;
            runningStateSignal.value = FAILED;
            onError?.(error, { event, action, args });
          });

          if (onError) {
            // Asking for the error IS taking it.
            markErrorAsDisplayedBy(error, "onError");
          }
          // Handed back, not delivered: failRun decides whether this leaves as
          // a throw or as a rejection, because only the caller below knows
          // which of the two this run was. The error is in errorSignal either
          // way — a screen reads it there, whether or not anything was waiting.
          return error;
        };

        // A failure leaves the run the way it came: thrown when the callback
        // threw synchronously — code that knows this action is synchronous
        // writes a plain `try/catch` around the call and has to find it there —
        // and rejected when the run was asynchronous, since the throw below
        // then happens inside a `then`. An abort is neither: it settles with
        // its reason as its value, the way it always has.
        const failRun = (error) => {
          const errorSettled = onRunError(error);
          if (runningStateSignal.peek() === ABORTED) {
            return errorSettled;
          }
          throw errorSettled;
        };

        try {
          const thenableArray = [];
          const callbackResult = callback(...args);
          if (callbackResult && typeof callbackResult.then === "function") {
            thenableArray.push(
              callbackResult.then(
                (value) => {
                  runResult = value;
                },
                (e) => {
                  rejected = true;
                  rejectedValue = e;
                },
              ),
            );
          } else {
            runResult = callbackResult;
          }
          if (ui.renderLoadedAsync && !ui.renderLoaded) {
            const renderLoadedPromise = ui.renderLoadedAsync(...args).then(
              (renderLoaded) => {
                ui.renderLoaded = renderLoaded;
              },
              (e) => {
                if (!rejected) {
                  rejected = true;
                  rejectedValue = e;
                }
              },
            );
            thenableArray.push(renderLoadedPromise);
          }
          if (thenableArray.length === 0) {
            return onRunEnd();
          }
          return Promise.all(thenableArray).then(() => {
            if (rejected) {
              return failRun(rejectedValue);
            }
            return onRunEnd();
          });
        } catch (e) {
          return failRun(e);
        }
      };

      const performReset = ({ reason, willRunOrPrerun }) => {
        abort(reason);
        if (DEBUG) {
          console.log(`"${action}": resetting (reason: ${reason})`);
        }

        prerunProtectionRegistry.unprotect(action);

        if (sideEffectCleanup) {
          sideEffectCleanup(reason);
          sideEffectCleanup = undefined;
        }
        if (completeSideEffectCleanup) {
          completeSideEffectCleanup(reason);
          completeSideEffectCleanup = undefined;
        }

        actionPromiseMap.delete(action);
        batch(() => {
          if (!willRunOrPrerun) {
            errorSignal.value = undefined;
            valueSignal.value = valueInitial;
            if (outputSignal) {
              outputSignal.value = undefined;
            }
          }
          isPrerunSignal.value = true;
          runningStateSignal.value = IDLE;
        });
      };

      const privateProperties = {
        valueInitial,

        performRun,
        performReset,
        ui,

        nameSignal: actionNameSignal,
        callSourceSignal: actionCallSourceSignal,

        childActionWeakSet,
        childActionWeakMap,
      };
      setActionPrivateProperties(action, privateProperties);
    }

    return action;
  };

  rootAction = createActionCore(rootOptions);
  actionWeakMap.set(callback, rootAction);
  return rootAction;
};

/**
 * Creates an action proxy that automatically updates based on signal changes.
 *
 * @param {Object} action - The base action to proxy
 * @param {Signal} paramsSignal - Signal containing parameters for the action
 * @param {Object} options - Configuration options
 * @param {boolean} options.rerunOnChange - Ensures the action is rerun every time a signal value is modified.
 *   This enables live updates - for example, performing an HTTP GET request every time
 *   a list of filters changes, providing real-time results without user interaction.
 * @param {boolean} options.inheritData - When false, each new target action starts fresh with no inherited state.
 *   By default (true), the proxy carries over the previous target's value and error into the new action.
 *   This keeps the facade in sync with the latest known data: `action.dataSignal.value` only changes when a
 *   new action completes, not when it starts loading. Code that needs to distinguish loading state can still
 *   check `action.runningState`, while code that just reads `action.data` always sees the most recent
 *   available data — even while a newer action is in flight.
 *   This default also enables "Apply Filters" workflows where parameters change but the action only reruns
 *   on an explicit user trigger: the previous results remain visible until the new action completes.
 * @param {function} options.onChange - Optional callback triggered when the target action changes
 */
const createActionProxyFromSignal = (
  action,
  paramsSignal,
  {
    runOnce = false,
    rerunOnChange = false,
    inheritData = true,
    onChange,
    syncParams,
    paramsSettlingSignal = NOT_SETTLING_SIGNAL,
  } = {},
) => {
  const actionTargetChangeCallbackSet = new Set();
  const onActionTargetChange = (callback) => {
    actionTargetChangeCallbackSet.add(callback);
    return () => {
      actionTargetChangeCallbackSet.delete(callback);
    };
  };
  const changeCleanupCallbackSet = new Set();
  const triggerTargetChange = (actionTarget, previousTarget, context) => {
    for (const changeCleanupCallback of changeCleanupCallbackSet) {
      changeCleanupCallback();
    }
    changeCleanupCallbackSet.clear();
    for (const callback of actionTargetChangeCallbackSet) {
      const returnValue = callback(actionTarget, previousTarget, context);
      if (typeof returnValue === "function") {
        changeCleanupCallbackSet.add(returnValue);
      }
    }
  };

  let actionTarget = null;
  let currentAction = action;
  let currentActionPrivateProperties = getActionPrivateProperties(action);
  let actionTargetPreviousWeakRef = null;

  const createTarget = (params) => {
    if (inheritData) {
      const previousActionTarget = actionTargetPreviousWeakRef?.deref();
      const previousTarget = previousActionTarget || action;
      return action.bindParams(params, {
        error: previousTarget.errorSignal.peek(),
        value: previousTarget.valueSignal.peek(),
      });
    }
    return action.bindParams(params);
  };

  let isUpdatingTarget = false;
  const _updateTarget = (context) => {
    if (isUpdatingTarget) {
      // likely syncParams caused the paramsSignal.value to update which
      // calls _updateTarget. But we are already in the middle of an update
      // likely cause by an explicit call to rerun for instance
      // so we want to keep that rerun intent and "ignore" this updateTarget call
      // so we don't end up running the action twice (once because we dispatch change without explicitRunIntent and one for the initial run intent)
      return;
    }
    isUpdatingTarget = true;
    action.debug(`${action}._updateTarget(${stringifyForDisplay(context)})`);
    if (syncParams) {
      syncParams();
    }
    isUpdatingTarget = false;

    const params = paramsSignal.peek();
    const proxyParams = proxyParamsSignal.peek();
    if (params !== proxyParams) {
      proxyParamsSignal.value = params;
    }
    const previousActionTarget = actionTargetPreviousWeakRef?.deref();

    if (params === NO_PARAMS) {
      actionTarget = null;
      currentAction = action;
      currentActionPrivateProperties = getActionPrivateProperties(action);
    } else {
      actionTarget = createTarget(params);
      if (previousActionTarget === actionTarget) {
        return;
      }
      currentAction = actionTarget;
      currentActionPrivateProperties = getActionPrivateProperties(actionTarget);
    }

    actionTargetPreviousWeakRef = actionTarget
      ? new WeakRef(actionTarget)
      : null;
    triggerTargetChange(actionTarget, previousActionTarget, context);
  };

  const proxyMethod = (method, { explicitRunIntent } = {}) => {
    return (...args) => {
      /*
       * Ensure the proxy targets the correct action before method execution.
       * This prevents race conditions where external effects run before our
       * internal parameter synchronization effect. Using peek() avoids creating
       * reactive dependencies within this pass-through method.
       */
      _updateTarget({
        changeCause: "method_call",
        changeCauseDetail: method,
        explicitRunIntent,
      });
      return currentAction[method](...args);
    };
  };

  const nameSignal = signal(action.name);
  const callSourceSignal = signal(`[Proxy] ${action.callSource}`);
  const actionProxy = function actionProxyFunction() {
    return actionProxy.rerun();
  };
  Object.defineProperty(actionProxy, "name", {
    configurable: true,
    get() {
      return nameSignal.value;
    },
  });
  Object.defineProperty(actionProxy, "callSource", {
    configurable: true,
    get() {
      return callSourceSignal.value;
    },
  });
  actionWeakMap.set(actionProxy, actionProxy);

  // Create our own signal for params that we control completely
  const proxyParamsSignal = signal(paramsSignal.value);
  const proxySignal = (signalPropertyName, propertyName) => {
    const signalProxy = signal();
    let dispose;
    onActionTargetChange(() => {
      if (dispose) {
        dispose();
        dispose = undefined;
      }
      dispose = effect(() => {
        const currentActionSignal = currentAction[signalPropertyName];
        const currentActionSignalValue = currentActionSignal.value;
        signalProxy.value = currentActionSignalValue;
        if (propertyName) {
          actionProxy[propertyName] = currentActionSignalValue;
        }
      });
      return dispose;
    });
    return signalProxy;
  };

  Object.assign(actionProxy, {
    isAction: true,
    isProxy: true,
    callback: undefined,
    params: undefined,
    isPrerun: undefined,
    runningState: undefined,
    aborted: undefined,
    error: undefined,
    value: undefined,
    data: undefined,
    completed: undefined,
    prerun: proxyMethod("prerun", { explicitRunIntent: true }),
    run: proxyMethod("run", { explicitRunIntent: true }),
    rerun: proxyMethod("rerun", { explicitRunIntent: true }),
    reset: proxyMethod("reset", { explicitRunIntent: true }),
    abort: proxyMethod("abort", { explicitRunIntent: true }),
    matchAllSelfOrDescendant: proxyMethod("matchAllSelfOrDescendant"),
    getCurrentAction: () => {
      _updateTarget({
        changeCause: "get_current_action",
      });
      return currentAction;
    },
    bindParams: () => {
      throw new Error(
        `bindParams() is not supported on action proxies, use the underlying action instead`,
      );
    },
    replaceParams: null, // Will be set below
    toString: () => actionProxy.callSource,
    meta: action.meta,

    paramsSignal: proxyParamsSignal,
    paramsSettlingSignal,
    isPrerunSignal: proxySignal("isPrerunSignal", "isPrerun"),
    runningStateSignal: proxySignal("runningStateSignal", "runningState"),
    errorSignal: proxySignal("errorSignal", "error"),
    valueSignal: proxySignal("valueSignal", "value"),
    dataSignal: proxySignal("dataSignal", "data"),
  });
  Object.preventExtensions(actionProxy);
  // Watch for changes in the original paramsSignal and update ours
  // (original signal wins over any replaceParams calls)
  weakEffect(
    [paramsSignal, proxyParamsSignal],
    (paramsSignalRef, proxyParamsSignalRef) => {
      const newParams = paramsSignalRef.value;
      proxyParamsSignalRef.value = newParams;
    },
  );
  weakEffect([action], () => {
    // eslint-disable-next-line no-unused-expressions
    proxyParamsSignal.value;
    _updateTarget({
      changeCause: "params_signal_change",
    });
  });
  onActionTargetChange((actionTarget) => {
    const currentAction = actionTarget || action;
    nameSignal.value = `[Proxy] ${currentAction.name}`;
    callSourceSignal.value = `[Proxy] ${currentAction.callSource}`;
    actionProxy.callback = currentAction.callback;
    actionProxy.params = currentAction.params;
    actionProxy.isPrerun = currentAction.isPrerun;
    actionProxy.runningState = currentAction.runningState;
    actionProxy.aborted = currentAction.aborted;
    actionProxy.error = currentAction.error;
    actionProxy.value = currentAction.value;
    actionProxy.data = currentAction.data;
    actionProxy.completed = currentAction.completed;
    actionProxy.meta = currentAction.meta;
  });

  proxy_private_props: {
    const proxyPrivateMethod = (method) => {
      return (...args) => currentActionPrivateProperties[method](...args);
    };
    const proxyPrivateProperties = {
      get currentAction() {
        return currentAction;
      },

      performRun: proxyPrivateMethod("performRun"),
      performReset: proxyPrivateMethod("performReset"),
      ui: currentActionPrivateProperties.ui,
    };
    onActionTargetChange(() => {
      proxyPrivateProperties.ui = currentActionPrivateProperties.ui;
      proxyPrivateProperties.childActionWeakSet =
        currentActionPrivateProperties.childActionWeakSet;
    });
    setActionPrivateProperties(actionProxy, proxyPrivateProperties);
  }

  actionProxy.replaceParams = (newParams) => {
    if (currentAction === action) {
      const currentParams = proxyParamsSignal.value;
      const nextParams = mergeActionParams(currentParams, newParams);
      if (nextParams === currentParams) {
        return false;
      }
      proxyParamsSignal.value = nextParams;
      return true;
    }
    if (!currentAction.replaceParams(newParams)) {
      return false;
    }
    proxyParamsSignal.value = currentAction.paramsSignal.peek();
    return true;
  };

  if (runOnce) {
    onActionTargetChange((actionTarget, actionTargetPrevious) => {
      if (!actionTargetPrevious && actionTarget) {
        action.debug(
          `Action proxy "${actionProxy}": target changed, running action once (reason: runOnce)`,
        );
        actionTarget.run({ reason: "runOnce" });
      }
    });
  }
  if (rerunOnChange) {
    onActionTargetChange(
      (actionTarget, actionTargetPrevious, { explicitRunIntent }) => {
        if (explicitRunIntent) {
          return;
        }
        if (
          actionTarget &&
          actionTargetPrevious &&
          !actionTargetPrevious.isPrerun
        ) {
          action.debug(
            `Action proxy "${actionProxy}": target changed, rerunning action (reason: rerunOnChange)`,
            {
              newTarget: actionTarget,
              previousTarget: actionTargetPrevious,
            },
          );
          actionTarget.rerun({ reason: "rerunOnChange (params modified)" });
        }
      },
    );
  }
  if (onChange) {
    onActionTargetChange(
      (actionTarget, actionTargetPrevious, { explicitRunIntent }) => {
        onChange(actionTarget, actionTargetPrevious, { explicitRunIntent });
      },
    );
  }

  return actionProxy;
};

const generateActionCallSource = (name, params) => {
  if (params === NO_PARAMS) {
    return `${name}()`;
  }
  // Use stringifyForDisplay with asFunctionArgs option for the entire args array
  const argsString = stringifyForDisplay([params], 3, 0, {
    asFunctionArgs: true,
  });
  return `${name}${argsString}`;
};

const isPlainObject = (obj) => {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  let proto = obj;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return (
    Object.getPrototypeOf(obj) === proto || Object.getPrototypeOf(obj) === null
  );
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    abortRunningActions();
  });
}
