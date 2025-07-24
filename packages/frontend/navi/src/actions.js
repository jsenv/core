import { prefixFirstAndIndentRemainingLines } from "@jsenv/humanize";
import { batch, computed, effect, signal } from "@preact/signals";
import {
  ABORTED,
  COMPLETED,
  FAILED,
  IDLE,
  RUNNING,
} from "./action_loading_states.js";
import {
  getActionPrivateProperties,
  setActionPrivateProperties,
} from "./action_private_properties.js";
import { SYMBOL_OBJECT_SIGNAL } from "./symbol_object_signal.js";
import { createIterableWeakSet } from "./utils/iterable_weak_set.js";
import { createJsValueWeakMap } from "./utils/js_value_weak_map.js";
import { mergeTwoJsValues } from "./utils/merge_two_js_values.js";
import {
  isSignal,
  stringifyForDisplay,
} from "./utils/stringify_for_display.js";
import { weakEffect } from "./utils/weak_effect.js";

const ACTION_AS_FUNCTION = true;
let DEBUG = true;
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
    stopSet: method === "stop" ? new Set([action]) : undefined,
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

export const reloadActions = async (
  actionSet,
  { reason = "reloadActions was called" } = {},
) => {
  return dispatchActions({
    rerunSet: actionSet,
    reason,
  });
};

export const unloadActions = async (
  actionSet,
  { reason = "unloadActions was called" } = {},
) => {
  return dispatchActions({
    stopSet: actionSet,
    reason,
  });
};
export const abortPendingActions = (
  reason = "abortPendingActions was called",
) => {
  const { loadingSet } = getActivationInfo();
  for (const runningAction of loadingSet) {
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
 * - The action is explicitly stopped via .stop()
 */
const preloadedProtectionRegistry = (() => {
  const protectedActionMap = new Map(); // action -> { timeoutId, timestamp }
  const PROTECTION_DURATION = 5 * 60 * 1000; // 5 minutes en millisecondes

  const unprotect = (action) => {
    const protection = protectedActionMap.get(action);
    if (protection) {
      clearTimeout(protection.timeoutId);
      protectedActionMap.delete(action);
      if (DEBUG) {
        const elapsed = Date.now() - protection.timestamp;
        console.debug(`"${action}": GC protection removed after ${elapsed}ms`);
      }
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
        if (DEBUG) {
          console.debug(
            `"${action}": preload protection expired after ${PROTECTION_DURATION}ms`,
          );
        }
      }, PROTECTION_DURATION);

      protectedActionMap.set(action, { timeoutId, timestamp });

      if (DEBUG) {
        console.debug(
          `"${action}": protected from GC for ${PROTECTION_DURATION}ms`,
        );
      }
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
  const loadingSet = new Set();
  const settledSet = new Set();

  for (const action of activationWeakSet) {
    const privateProps = getActionPrivateProperties(action);
    const runningState = privateProps.runningStateSignal.peek();

    if (runningState === RUNNING) {
      loadingSet.add(action);
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
    loadingSet,
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
  stopSet = new Set(),
  // Legacy compatibility
  preloadSet = new Set(),
  loadSet = new Set(),
  reloadSet = new Set(),
  unloadSet = new Set(),
  abortSignalMap = new Map(),
  onEnd,
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
   * - stopSet: actions to stop/abort
   *
   * Priority resolution:
   * - stop always wins (explicit cleanup)
   * - rerun > run > prerun (rerun forces refresh even if already running)
   * - An action in multiple sets triggers warnings in dev mode
   *
   * Output: Internal operation sets that track what will actually happen
   * - willStopSet: actions that will be stopped/aborted
   * - willPrerunSet: actions that will be prerun
   * - willRunSet: actions that will be run
   * - willPromoteSet: prerun actions that become run-requested
   * - stays*Set: actions that remain in their current state
   */

  // Merge legacy parameters with new ones
  const finalPrerunSet = new Set([...prerunSet, ...preloadSet]);
  const finalRunSet = new Set([...runSet, ...loadSet]);
  const finalRerunSet = new Set([...rerunSet, ...reloadSet]);
  const finalStopSet = new Set([...stopSet, ...unloadSet]);

  const { loadingSet, settledSet } = getActivationInfo();

  // Warn about overlapping sets in development
  if (import.meta.dev) {
    const allSets = [
      { name: "prerun", set: finalPrerunSet },
      { name: "run", set: finalRunSet },
      { name: "rerun", set: finalRerunSet },
      { name: "stop", set: finalStopSet },
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
    console.group(`updateActions()`);
    const lines = [
      ...(finalPrerunSet.size
        ? [formatActionSet(finalPrerunSet, "- prerun:")]
        : []),
      ...(finalRunSet.size ? [formatActionSet(finalRunSet, "- run:")] : []),
      ...(finalRerunSet.size
        ? [formatActionSet(finalRerunSet, "- rerun:")]
        : []),
      ...(finalStopSet.size ? [formatActionSet(finalStopSet, "- stop:")] : []),
    ];
    console.debug(
      `requested operations:
${lines.join("\n")}
- meta: { reason: ${reason}, isReplace: ${isReplace} }`,
    );
  }

  // Internal sets that track what operations will actually be performed
  const willStopSet = new Set();
  const willPrerunSet = new Set();
  const willRunSet = new Set();
  const willPromoteSet = new Set(); // prerun -> run requested
  const staysLoadingSet = new Set();
  const staysAbortedSet = new Set();
  const staysFailedSet = new Set();
  const staysLoadedSet = new Set();

  // Step 1: Determine which actions will be stopped
  collect_actions_to_stop: {
    for (const actionToStop of finalStopSet) {
      if (actionToStop.runningState !== IDLE) {
        willStopSet.add(actionToStop);
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
        // Unless it's a rerun or the action is also being stopped
        if (isRerun || willStopSet.has(action)) {
          // Force stop first, then rerun/run
          willStopSet.add(action);
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
    for (const actionToPrerun of finalPrerunSet) {
      if (
        finalRunSet.has(actionToPrerun) ||
        finalRerunSet.has(actionToPrerun)
      ) {
        // run/rerun wins over prerun - skip prerun
        continue;
      }
      handleActionRequest(actionToPrerun, "prerun");
    }

    // Process runSet (medium priority)
    for (const actionToRun of finalRunSet) {
      if (finalRerunSet.has(actionToRun)) {
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
    for (const actionToRerun of finalRerunSet) {
      handleActionRequest(actionToRerun, "rerun");
    }
  }
  const allThenableArray = [];

  // Step 3: Determine which actions will stay in their current state
  collect_actions_that_stay: {
    for (const actionLoading of loadingSet) {
      if (willStopSet.has(actionLoading)) {
        // will be stopped (aborted), we don't want to wait
      } else if (
        willRunSet.has(actionLoading) ||
        willPrerunSet.has(actionLoading)
      ) {
        // will be run, we'll wait for the new run promise
      } else {
        // an action that was loading and not affected by this update
        const actionPromise = actionPromiseMap.get(actionLoading);
        allThenableArray.push(actionPromise);
        staysLoadingSet.add(actionLoading);
      }
    }
    for (const actionLoaded of settledSet) {
      if (willStopSet.has(actionLoaded)) {
        // will be stopped
      } else if (actionLoaded.runningState === ABORTED) {
        staysAbortedSet.add(actionLoaded);
      } else if (actionLoaded.runningState === FAILED) {
        staysFailedSet.add(actionLoaded);
      } else {
        staysLoadedSet.add(actionLoaded);
      }
    }
  }
  if (DEBUG) {
    const lines = [
      ...(willStopSet.size
        ? [formatActionSet(willStopSet, "- will stop:")]
        : []),
      ...(willPrerunSet.size
        ? [formatActionSet(willPrerunSet, "- will prerun:")]
        : []),
      ...(willPromoteSet.size
        ? [formatActionSet(willPromoteSet, "- will promote:")]
        : []),
      ...(willRunSet.size ? [formatActionSet(willRunSet, "- will run:")] : []),
      ...(staysLoadingSet.size
        ? [formatActionSet(staysLoadingSet, "- stays loading:")]
        : []),
      ...(staysAbortedSet.size
        ? [formatActionSet(staysAbortedSet, "- stays aborted:")]
        : []),
      ...(staysFailedSet.size
        ? [formatActionSet(staysFailedSet, "- stays failed:")]
        : []),
      ...(staysLoadedSet.size
        ? [formatActionSet(staysLoadedSet, "- stays loaded:")]
        : []),
    ];
    console.debug(`operations that will be performed:
${lines.join("\n")}`);
  }

  // Step 4: Execute stops
  execute_stops: {
    for (const actionToStop of willStopSet) {
      const actionToStopPrivateProperties =
        getActionPrivateProperties(actionToStop);
      actionToStopPrivateProperties.performUnload({ reason });
      activationWeakSet.delete(actionToStop);
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
      const performLoadResult = actionToRunPrivateProperties.performLoad({
        globalAbortSignal,
        abortSignal: effectiveSignal,
        reason,
        isPreload: isPrerun,
        onEnd,
        onAbort,
        onError,
      });
      activationWeakSet.add(actionToPrerunOrRun);

      if (performLoadResult && typeof performLoadResult.then === "function") {
        actionPromiseMap.set(actionToPrerunOrRun, performLoadResult);
        allThenableArray.push(performLoadResult);
        hasAsync = true;
        // Store async result with order info
        resultArray.push({
          type: "async",
          promise: performLoadResult,
        });
      } else {
        // Store sync result with order info
        resultArray.push({
          type: "sync",
          result: performLoadResult,
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
      const actionToPromotePrivateProperties =
        getActionPrivateProperties(actionToPromote);
      actionToPromotePrivateProperties.isPrerunSignal.value = false;
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
  const loadingActionSet = new Set([...willPrerunSet, ...willRunSet]);
  return {
    requestedResult,
    allResult,
    loadingActionSet,
  };
};

const NO_PARAMS = {};
const initialParamsDefault = NO_PARAMS;
const metaDefault = {};

const actionWeakMap = new WeakMap();
export const createAction = (callback, rootOptions = {}) => {
  const existing = actionWeakMap.get(callback);
  if (existing) {
    return existing;
  }

  let rootAction;

  const createActionCore = (
    {
      name = callback.name || "anonymous",
      params = initialParamsDefault,
      isPrerun = true,
      runningState = IDLE,
      aborted = false,
      error = null,
      data,
      computedData,
      compute,
      renderLoadedAsync,
      sideEffect = () => {},
      keepOldData = false,
      meta = metaDefault,
      dataEffect,
      onLoad = () => {},
    },
    { parentAction } = {},
  ) => {
    const initialData = data;
    const paramsSignal = signal(params);
    const isPrerunSignal = signal(isPrerun);
    const runningStateSignal = signal(runningState);
    const errorSignal = signal(error);
    const dataSignal = signal(initialData);
    const computedDataSignal = compute
      ? computed(() => {
          const data = dataSignal.value;
          return compute(data);
        })
      : dataSignal;
    computedData =
      computedData === undefined
        ? compute
          ? compute(data)
          : data
        : computedData;

    const prerun = (options) => {
      return dispatchSingleAction(action, "prerun", options);
    };
    const run = (options) => {
      return dispatchSingleAction(action, "run", options);
    };
    const rerun = (options) => {
      return dispatchSingleAction(action, "rerun", options);
    };
    /**
     * Stop the action completely - this will:
     * 1. Abort the action if it's currently running
     * 2. Reset the action to IDLE state
     * 3. Clean up any resources and side effects
     * 4. Reset data to initial value (unless keepOldData is true)
     */
    const stop = (options) => {
      return dispatchSingleAction(action, "stop", options);
    };
    // Legacy compatibility
    const preload = prerun;
    const load = run;
    const reload = rerun;
    const unload = stop;
    const abort = (reason) => {
      if (runningState !== RUNNING) {
        return false;
      }
      const actionAbort = actionAbortMap.get(action);
      if (!actionAbort) {
        return false;
      }
      if (DEBUG) {
        console.log(`"${action}": aborting (reason: ${reason})`);
      }
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
          return mergeTwoJsValues(params, newParams);
        });
        return createActionProxyFromSignal(
          action,
          combinedParamsSignal,
          options,
        );
      }

      // ✅ CAS 2: Objet -> vérifier s'il contient des signals
      if (newParamsOrSignal && typeof newParamsOrSignal === "object") {
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
          if (params === null || typeof params !== "object") {
            return createChildAction(newParamsOrSignal, options);
          }
          const combinedParams = mergeTwoJsValues(params, newParamsOrSignal);
          return createChildAction({
            params: combinedParams,
            ...options,
          });
        }

        // Combiner avec les params existants pour les valeurs statiques
        const paramsSignal = computed(() => {
          const params = {};
          for (const key of keyArray) {
            const signalForThisKey = signalMap.get(key);
            if (signalForThisKey) {
              params[key] = signalForThisKey.value;
            } else {
              params[key] = staticParams[key];
            }
          }
          return params;
        });
        return createActionProxyFromSignal(action, paramsSignal, options);
      }

      // ✅ CAS 3: Primitive -> action enfant
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

    name = generateActionName(name, params);
    if (ACTION_AS_FUNCTION) {
      // Create the action as a function that can be called directly
      action = function actionFunction(params) {
        const boundAction = bindParams(params);
        return boundAction.rerun();
      };
      Object.defineProperty(action, "name", {
        configurable: true,
        writable: true,
        value: name,
      });
    } else {
      action = { name };
    }

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
      data,
      computedData,
      prerun,
      run,
      rerun,
      stop,
      // Legacy compatibility
      preload,
      load,
      reload,
      unload,
      abort,
      bindParams,
      matchAllSelfOrDescendant, // ✅ Add the new method
      replaceParams: (newParams) => {
        const currentParams = paramsSignal.value;
        const nextParams = mergeTwoJsValues(currentParams, newParams);
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
        action.name = generateActionName(name, nextParams);
        paramsSignal.value = nextParams;
        return true;
      },
      toString: () => action.name,
      meta,
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
      });
      weakEffect([action], (actionRef) => {
        error = errorSignal.value;
        actionRef.error = error;
      });
      weakEffect([action], (actionRef) => {
        data = dataSignal.value;
        computedData = computedDataSignal.value;
        actionRef.data = data;
        actionRef.computedData = computedData;
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

      const performLoad = (loadParams) => {
        const {
          globalAbortSignal,
          abortSignal,
          reason,
          isPreload,
          onEnd,
          onAbort,
          onError,
        } = loadParams;

        if (isPreload) {
          preloadedProtectionRegistry.protect(action);
        }

        const internalAbortController = new AbortController();
        const internalAbortSignal = internalAbortController.signal;
        const abort = (abortReason) => {
          runningStateSignal.value = ABORTED;
          internalAbortController.abort(abortReason);
          actionAbortMap.delete(action);
          if (isPreload && (globalAbortSignal.aborted || abortSignal.aborted)) {
            preloadedProtectionRegistry.unprotect(action);
          }
          if (DEBUG) {
            console.log(`"${action}": aborted (reason: ${abortReason})`);
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
          errorSignal.value = null;
          runningStateSignal.value = RUNNING;
          if (!isPreload) {
            isPrerunSignal.value = false;
          }
        });

        const args = [];
        args.push(params);
        args.push({ signal: internalAbortSignal, reason, isPreload });
        const returnValue = sideEffect(...args);
        if (typeof returnValue === "function") {
          sideEffectCleanup = returnValue;
        }

        let loadResult;
        let rejected = false;
        let rejectedValue;
        const onLoadEnd = () => {
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbortFromSpecific);
          }
          if (globalAbortSignal) {
            globalAbortSignal.removeEventListener("abort", onAbortFromGlobal);
          }
          preloadedProtectionRegistry.unprotect(action);
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          /*
           * Critical: dataEffect and onLoad must be batched together to prevent
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
            dataSignal.value = dataEffect
              ? dataEffect(loadResult, action)
              : loadResult;
            runningStateSignal.value = COMPLETED;
            if (onEnd) {
              onEnd(computedDataSignal.peek(), action);
            }
            onLoad(action);
          });
          if (DEBUG) {
            console.log(`"${action}": completed (reason: ${reason})`);
          }
          return computedDataSignal.peek();
        };
        const onLoadError = (e) => {
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbortFromSpecific);
          }
          if (globalAbortSignal) {
            globalAbortSignal.removeEventListener("abort", onAbortFromGlobal);
          }
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          if (internalAbortSignal.aborted && e === internalAbortSignal.reason) {
            runningStateSignal.value = ABORTED;
            if (isPreload && abortSignal.aborted) {
              preloadedProtectionRegistry.unprotect(action);
            }
            onAbort(e, action);
            return e;
          }
          if (e.name === "AbortError") {
            throw new Error(
              "never supposed to happen, abort error should be handled by the abort signal",
            );
          }
          if (DEBUG) {
            console.log(
              `"${action}": failed (error: ${e}, handled by ui: ${ui.hasRenderers})`,
            );
          }
          batch(() => {
            errorSignal.value = e;
            runningStateSignal.value = FAILED;
            if (onError) {
              onError(e, action);
            }
          });

          if (ui.hasRenderers) {
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
                  loadResult = value;
                },
                (e) => {
                  rejected = true;
                  rejectedValue = e;
                },
              ),
            );
          } else {
            loadResult = callbackResult;
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
            return onLoadEnd();
          }
          return Promise.all(thenableArray).then(() => {
            if (rejected) {
              return onLoadError(rejectedValue);
            }
            return onLoadEnd();
          });
        } catch (e) {
          return onLoadError(e);
        }
      };

      const performUnload = ({ reason }) => {
        abort(reason);
        if (DEBUG) {
          console.log(`"${action}": unloading (reason: ${reason})`);
        }

        preloadedProtectionRegistry.unprotect(action);

        if (sideEffectCleanup) {
          sideEffectCleanup(reason);
          sideEffectCleanup = undefined;
        }

        actionPromiseMap.delete(action);
        batch(() => {
          errorSignal.value = null;
          if (!keepOldData) {
            dataSignal.value = initialData;
          }
          isPrerunSignal.value = true;
          runningStateSignal.value = IDLE;
        });
      };

      const privateProperties = {
        initialData,

        paramsSignal,
        runningStateSignal,
        isPrerunSignal,
        dataSignal,
        computedDataSignal,
        errorSignal,

        performLoad,
        performUnload,
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

const createActionProxyFromSignal = (
  action,
  paramsSignal,
  { reloadOnChange = false, onChange } = {},
) => {
  const actionTargetChangeCallbackSet = new Set();
  const onActionTargetChange = (callback) => {
    actionTargetChangeCallbackSet.add(callback);
    return () => {
      actionTargetChangeCallbackSet.delete(callback);
    };
  };
  const changeCleanupCallbackSet = new Set();
  const triggerTargetChange = (actionTarget, previousTarget) => {
    for (const changeCleanupCallback of changeCleanupCallbackSet) {
      changeCleanupCallback();
    }
    changeCleanupCallbackSet.clear();
    for (const callback of actionTargetChangeCallbackSet) {
      const returnValue = callback(actionTarget, previousTarget);
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

  const _updateTarget = (params) => {
    const previousActionTarget = actionTargetPreviousWeakRef?.deref();

    if (params === NO_PARAMS) {
      actionTarget = null;
      currentAction = action;
      currentActionPrivateProperties = getActionPrivateProperties(action);
    } else {
      actionTarget = action.bindParams(params);
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
    triggerTargetChange(actionTarget, previousActionTarget);
  };

  const proxyMethod = (method) => {
    return (...args) => {
      /*
       * Ensure the proxy targets the correct action before method execution.
       * This prevents race conditions where external effects run before our
       * internal parameter synchronization effect. Using peek() avoids creating
       * reactive dependencies within this pass-through method.
       */
      _updateTarget(proxyParamsSignal.peek());
      return currentAction[method](...args);
    };
  };

  const nameSignal = signal();
  const actionProxy = {
    isProxy: true,
    callback: undefined,
    get name() {
      return nameSignal.value;
    },
    params: undefined,
    isPrerun: undefined,
    runningState: undefined,
    aborted: undefined,
    error: undefined,
    data: undefined,
    computedData: undefined,
    prerun: proxyMethod("prerun"),
    run: proxyMethod("run"),
    rerun: proxyMethod("rerun"),
    stop: proxyMethod("stop"),
    // Legacy compatibility
    preload: proxyMethod("preload"),
    load: proxyMethod("load"),
    reload: proxyMethod("reload"),
    unload: proxyMethod("unload"),
    abort: proxyMethod("abort"),
    matchAllSelfOrDescendant: proxyMethod("matchAllSelfOrDescendant"),
    getCurrentAction: () => {
      _updateTarget(proxyParamsSignal.peek());
      return currentAction;
    },
    replaceParams: null, // Will be set below
    toString: () => actionProxy.name,
    meta: {},
  };
  Object.preventExtensions(actionProxy);

  onActionTargetChange((actionTarget) => {
    const currentAction = actionTarget || action;
    nameSignal.value = `[Proxy] ${currentAction.name}`;
    actionProxy.callback = currentAction.callback;
    actionProxy.params = currentAction.params;
    actionProxy.isPrerun = currentAction.isPrerun;
    actionProxy.runningState = currentAction.runningState;
    actionProxy.aborted = currentAction.aborted;
    actionProxy.error = currentAction.error;
    actionProxy.data = currentAction.data;
    actionProxy.computedData = currentAction.computedData;
  });

  const proxyPrivateSignal = (signalPropertyName, propertyName) => {
    const signalProxy = signal();
    let dispose;
    onActionTargetChange(() => {
      if (dispose) {
        dispose();
        dispose = undefined;
      }
      dispose = effect(() => {
        const currentActionSignal =
          currentActionPrivateProperties[signalPropertyName];
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
  const proxyPrivateMethod = (method) => {
    return (...args) => currentActionPrivateProperties[method](...args);
  };

  // Create our own signal for params that we control completely
  const proxyParamsSignal = signal(paramsSignal.value);

  // Watch for changes in the original paramsSignal and update ours
  // (original signal wins over any replaceParams calls)
  weakEffect(
    [paramsSignal, proxyParamsSignal],
    (paramsSignalRef, proxyParamsSignalRef) => {
      proxyParamsSignalRef.value = paramsSignalRef.value;
    },
  );

  const proxyPrivateProperties = {
    get currentAction() {
      return currentAction;
    },
    paramsSignal: proxyParamsSignal,
    isPrerunSignal: proxyPrivateSignal("isPrerunSignal", "isPrerun"),
    runningStateSignal: proxyPrivateSignal(
      "runningStateSignal",
      "runningState",
    ),
    errorSignal: proxyPrivateSignal("errorSignal", "error"),
    dataSignal: proxyPrivateSignal("dataSignal", "data"),
    computedDataSignal: proxyPrivateSignal("computedDataSignal"),
    performLoad: proxyPrivateMethod("performLoad"),
    performUnload: proxyPrivateMethod("performUnload"),
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

  {
    weakEffect([action], () => {
      const params = proxyParamsSignal.value;
      _updateTarget(params);
    });
  }

  actionProxy.replaceParams = (newParams) => {
    if (currentAction === action) {
      const currentParams = proxyParamsSignal.value;
      const nextParams = mergeTwoJsValues(currentParams, newParams);
      if (nextParams === currentParams) {
        return false;
      }
      proxyParamsSignal.value = nextParams;
      return true;
    }
    if (!currentAction.replaceParams(newParams)) {
      return false;
    }
    proxyParamsSignal.value =
      currentActionPrivateProperties.paramsSignal.peek();
    return true;
  };

  if (reloadOnChange) {
    onActionTargetChange((actionTarget, actionTargetPrevious) => {
      if (
        actionTarget &&
        actionTargetPrevious &&
        !actionTargetPrevious.isPrerun
      ) {
        actionTarget.reload();
      }
    });
  }
  if (onChange) {
    onActionTargetChange((actionTarget, actionTargetPrevious) => {
      onChange(actionTarget, actionTargetPrevious);
    });
  }

  return actionProxy;
};

const generateActionName = (name, params) => {
  if (params === NO_PARAMS) {
    return `${name}({})`;
  }
  // Use stringifyForDisplay with asFunctionArgs option for the entire args array
  const argsString = stringifyForDisplay([params], 3, 0, {
    asFunctionArgs: true,
  });
  return `${name}${argsString}`;
};

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    abortPendingActions();
  });
}
