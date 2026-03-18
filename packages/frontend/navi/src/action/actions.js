import { createIterableWeakSet } from "@jsenv/dom";
import { prefixFirstAndIndentRemainingLines } from "@jsenv/humanize";
import { batch, computed, effect, signal } from "@preact/signals";

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
import { SYMBOL_OBJECT_SIGNAL } from "./symbol_object_signal.js";

let DEBUG = false;
export const enableDebugActions = () => {
  DEBUG = true;
};

const ACTION_AS_FUNCTION = true;

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

export const rerunActions = async (
  actionSet,
  { reason = "rerunActions was called" } = {},
) => {
  return dispatchActions({
    rerunSet: actionSet,
    reason,
  });
};

export const resetActions = async (
  actionSet,
  { reason = "resetActions was called" } = {},
) => {
  return dispatchActions({
    resetSet: actionSet,
    reason,
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
  const PROTECTION_DURATION = 5 * 60 * 1000; // 5 minutes en millisecondes

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
      // Si déjà protégée, étendre la protection
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

    isProtected(action) {
      return protectedActionMap.has(action);
    },

    // Pour debugging
    getProtectedActions() {
      return Array.from(protectedActionMap.keys());
    },

    // Nettoyage manuel si nécessaire
    clear() {
      for (const [, protection] of protectedActionMap) {
        clearTimeout(protection.timeoutId);
      }
      protectedActionMap.clear();
    },
  };
})();

export const formatActionSet = (actionSet, prefix = "") => {
  let message = "";
  message += `${prefix}`;
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
    let argSource = `reason: \`${reason}\``;
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
        // maybe remove this check one the API is stable because
        // nothing in the API should allow this to happen
        throw new Error(
          `Proxy should not be reach this point, use the underlying action instead`,
        );
      }
      const actionSpecificSignal = abortSignalMap.get(actionToPrerunOrRun);
      const effectiveSignal = actionSpecificSignal || abortSignal;

      const actionToRunPrivateProperties =
        getActionPrivateProperties(actionToPrerunOrRun);
      const performRunResult = actionToRunPrivateProperties.performRun({
        globalAbortSignal,
        abortSignal: effectiveSignal,
        reason,
        isPrerun,
        onComplete,
        onAbort,
        onError,
      });
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
      resultArray.map((item) =>
        item.type === "sync" ? item.result : item.promise,
      ),
    );
  } else {
    requestedResult = resultArray.map((item) => item.result);
  }

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
const initialParamsDefault = NO_PARAMS;
const mergeActionParams = (currentParams, newParams) => {
  if (currentParams === NO_PARAMS) {
    return newParams;
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
      params = initialParamsDefault;
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
      ? computed(() => {
          const value = valueSignal.value;
          const data = valueToData(value);
          return data;
        })
      : valueSignal;

    const prerun = (options) => {
      action.debug(`${action}.prerun(${stringifyForDisplay(options)})`);
      return dispatchSingleAction(action, "prerun", options);
    };
    const run = (options) => {
      action.debug(`${action}.run(${stringifyForDisplay(options)})`);
      return dispatchSingleAction(action, "run", options);
    };
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
      if (runningState !== RUNNING) {
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
      // ✅ CAS 1: Signal direct -> proxy
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

      // ✅ CAS 2: Objet -> vérifier s'il contient des signals
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
          // Pas de signals, merge statique normal
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
          return createChildAction({
            ...options,
            params: combinedParams,
          });
        }

        // Combiner avec les params existants pour les valeurs statiques
        const paramsSignal = computed(() => {
          const params = {};
          for (const key of keyArray) {
            const signalForThisKey = signalMap.get(key);
            if (signalForThisKey) {
              // eslint-disable-next-line signals/no-conditional-value-read
              params[key] = signalForThisKey.value;
            } else {
              params[key] = staticParams[key];
            }
          }
          return params;
        });
        return createActionProxyFromSignal(action, paramsSignal, options);
      }

      // ✅ CAS 3: Primitive or objects like DOMEvents etc -> action enfant
      return createChildAction({
        params: newParamsOrSignal,
        ...options,
      });
    };
    const bindParams = (newParamsOrSignal, options = {}) => {
      const existingChildAction = childActionWeakMap.get(newParamsOrSignal);
      if (existingChildAction) {
        return existingChildAction;
      }
      const childAction = _bindParams(newParamsOrSignal, options);
      childActionWeakMap.set(newParamsOrSignal, childAction);
      childActionWeakSet.add(childAction);

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

    // ✅ Implement matchAllSelfOrDescendant
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

    if (ACTION_AS_FUNCTION) {
      // Create the action as a function that can be called directly
      action = function actionFunction(...args) {
        if (args.length === 0) {
          return action.rerun();
        }
        const boundAction = bindParams(...args);
        return boundAction.rerun();
      };
      Object.defineProperty(action, "name", {
        configurable: true,
        writable: true,
        value: name,
      });
      // Register the action function itself so that createAction(action) returns
      // the same action instead of creating a new one
      actionWeakMap.set(action, action);
    } else {
      action = { name };
    }

    const callSource = generateActionCallSource(name, params);
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
      matchAllSelfOrDescendant, // ✅ Add the new method
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
      callSource,
      toString: () => action.callSource,
      meta,
      debug: (...args) => {
        if (!meta.debug || DEBUG) {
          return;
        }
        console.debug(...args);
      },

      paramsSignal,
      runningStateSignal,
      isPrerunSignal,
      valueSignal,
      dataSignal,
      errorSignal,
    });
    Object.preventExtensions(action);

    // Effects pour synchroniser les propriétés
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

    // Propriétés privées
    private_properties: {
      const ui = {
        renderLoaded: null,
        renderLoadedAsync,
        hasRenderers: false, // Flag to track if action is bound to UI components
      };
      let sideEffectCleanup;

      const performRun = (runParams) => {
        const {
          globalAbortSignal,
          abortSignal,
          reason,
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
        args.push({ signal: internalAbortSignal, reason, isPrerun });
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
            completeSideEffect?.(action);
          });
          if (DEBUG) {
            console.log(`"${action}": completed`);
          }
          const data = dataSignal.peek();
          return data;
        };
        const onRunError = (e) => {
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbortFromSpecific);
          }
          if (globalAbortSignal) {
            globalAbortSignal.removeEventListener("abort", onAbortFromGlobal);
          }
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          const isAbort =
            (internalAbortSignal.aborted && e === internalAbortSignal.reason) ||
            e.name === "AbortError";
          if (isAbort) {
            runningStateSignal.value = ABORTED;
            if (isPrerun && abortSignal.aborted) {
              prerunProtectionRegistry.unprotect(action);
            }
            onAbort?.(e, action);
            return e;
          }
          if (DEBUG) {
            console.log(
              `"${action}": failed (error: ${e}, handled by ui: ${ui.hasRenderers})`,
            );
          }
          batch(() => {
            errorSignal.value = e;
            runningStateSignal.value = FAILED;
            onError?.(e, action);
          });

          if (ui.hasRenderers || onError) {
            console.error(e);
            // For UI-bound actions: error is properly handled by logging + UI display
            // Return error instead of throwing to signal it's handled and prevent:
            // - jsenv error overlay from appearing
            // - error being treated as unhandled by runtime
            return e;
          }
          throw e;
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
              return onRunError(rejectedValue);
            }
            return onRunEnd();
          });
        } catch (e) {
          return onRunError(e);
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
 * @param {boolean} options.isolate - Ensures the new action is fresh (does not inherit value/error from previous action)
 * By default the proxy action inherits the current value and error of the previous action to provide a seamless transition.
 * Setting isolate to true creates a completely new action instance with default state on each update.
 * The default behavior allow for instance "Apply Filters" workflows where users modify filters but results are only
 * updated when they explicitly trigger the action (e.g., clicking an "Apply" button).
 * The old data remains visible until the new action completes.
 * @param {function} options.onChange - Optional callback triggered when the target action changes
 */
const createActionProxyFromSignal = (
  action,
  paramsSignal,
  {
    runOnce = false,
    rerunOnChange = false,
    isolate = false,
    onChange,
    syncParams,
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
  let isFirstEffect = true;

  const createTarget = (params) => {
    if (isolate) {
      return action.bindParams(params);
    }
    const previousActionTarget = actionTargetPreviousWeakRef?.deref();
    const previousTarget = previousActionTarget || action;
    return action.bindParams(params, {
      error: previousTarget.errorSignal.peek(),
      value: previousTarget.valueSignal.peek(),
    });
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

    if (isFirstEffect) {
      isFirstEffect = false;
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

  const nameSignal = signal();
  const callSourceSignal = signal();
  let actionProxy;
  if (ACTION_AS_FUNCTION) {
    actionProxy = function actionProxyFunction() {
      return actionProxy.rerun();
    };
    Object.defineProperty(actionProxy, "name", {
      configurable: true,
      get() {
        return nameSignal.value;
      },
    });
    actionWeakMap.set(actionProxy, actionProxy);
  } else {
    actionProxy = {
      get name() {
        return nameSignal.value;
      },
    };
  }

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
    callSource: actionProxy.callSource,
    toString: () => actionProxy.callSource,
    meta: {},

    paramsSignal: proxyParamsSignal,
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
    onActionTargetChange((actionTarget, previousTarget) => {
      proxyPrivateProperties.ui = currentActionPrivateProperties.ui;
      if (previousTarget && actionTarget) {
        const previousPrivateProps = getActionPrivateProperties(previousTarget);
        if (previousPrivateProps.ui.hasRenderers) {
          const newPrivateProps = getActionPrivateProperties(actionTarget);
          newPrivateProps.ui.hasRenderers = true;
        }
      }
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

const COMPLETED_ACTION = createAction(() => undefined, {
  name: "ACTION.COMPLETED",
});
getActionPrivateProperties(COMPLETED_ACTION).performRun({});

export const ACTION = {
  create: createAction,
  COMPLETED: COMPLETED_ACTION,
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    abortRunningActions();
  });
}
