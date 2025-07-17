import { prefixFirstAndIndentRemainingLines } from "@jsenv/humanize";
import { batch, computed, effect, signal } from "@preact/signals";
import {
  ABORTED,
  FAILED,
  IDLE,
  LOADED,
  LOADING,
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
export const setActionDispatcher = (value) => {
  dispatchActions = value;
};

export const reloadActions = async (
  actionSet,
  { reason = "reloadActions was called" } = {},
) => {
  return dispatchActions({
    reloadSet: actionSet,
    reason,
  });
};
export const abortPendingActions = (
  reason = "abortPendingActions was called",
) => {
  const { loadingSet } = getActivationInfo();
  for (const loadingAction of loadingSet) {
    loadingAction.abort(reason);
  }
};

/**
 * Registry that prevents preloaded actions from being garbage collected.
 *
 * When an action is preloaded, it might not have any active references yet
 * (e.g., the component that will use it hasn't loaded yet due to dynamic imports).
 * This registry keeps a reference to preloaded actions for a configurable duration
 * to ensure they remain available when needed.
 *
 * Actions are automatically unprotected when:
 * - The protection duration expires (default: 5 minutes)
 * - The action is explicitly unloaded via .unload()
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

const formatActionSet = (prefix, actionSet) => {
  let message = "";
  message += `- ${prefix}:`;
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
    const loadingState = privateProps.loadingStateSignal.peek();

    if (loadingState === LOADING) {
      loadingSet.add(action);
    } else if (
      loadingState === LOADED ||
      loadingState === FAILED ||
      loadingState === ABORTED
    ) {
      settledSet.add(action);
    } else {
      throw new Error(
        `An action in the activation weak set must be LOADING, ABORTED, FAILED or LOADED, found "${loadingState.id}" for action "${action}"`,
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
          loadingState: action.loadingState.id,
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
  preloadSet = new Set(),
  loadSet = new Set(),
  reloadSet = new Set(),
  unloadSet = new Set(),
  abortSignalMap = new Map(),
} = {}) => {
  /*
   * Action update flow:
   *
   * Input: 4 sets of requested operations
   * - preloadSet: actions to preload (background, low priority)
   * - loadSet: actions to load (user-visible, medium priority)
   * - reloadSet: actions to force reload (highest priority)
   * - unloadSet: actions to unload/abort
   *
   * Priority resolution:
   * - unload always wins (explicit cleanup)
   * - reload > load > preload (reload forces refresh even if already loaded)
   * - An action in multiple sets triggers warnings in dev mode
   *
   * Output: Internal operation sets that track what will actually happen
   * - willUnloadSet: actions that will be unloaded/aborted
   * - willPreloadSet: actions that will be preloaded
   * - willLoadSet: actions that will be loaded
   * - willPromoteSet: preloaded actions that become load-requested
   * - stays*Set: actions that remain in their current state
   */

  const { loadingSet, settledSet } = getActivationInfo();

  // Warn about overlapping sets in development
  if (import.meta.dev) {
    const allSets = [
      { name: "preload", set: preloadSet },
      { name: "load", set: loadSet },
      { name: "reload", set: reloadSet },
      { name: "unload", set: unloadSet },
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
      ...(preloadSet.size ? [formatActionSet("preload", preloadSet)] : []),
      ...(loadSet.size ? [formatActionSet("load", loadSet)] : []),
      ...(reloadSet.size ? [formatActionSet("reload", reloadSet)] : []),
      ...(unloadSet.size ? [formatActionSet("unload", unloadSet)] : []),
    ];
    console.debug(
      `requested operations:
${lines.join("\n")}
- meta: { reason: ${reason}, isReplace: ${isReplace} }`,
    );
  }

  // Internal sets that track what operations will actually be performed
  const willUnloadSet = new Set();
  const willPreloadSet = new Set();
  const willLoadSet = new Set();
  const willPromoteSet = new Set(); // preloaded -> load requested
  const staysLoadingSet = new Set();
  const staysAbortedSet = new Set();
  const staysFailedSet = new Set();
  const staysLoadedSet = new Set();

  // Step 1: Determine which actions will be unloaded
  collect_actions_to_unload: {
    for (const actionToUnload of unloadSet) {
      if (actionToUnload.loadingState !== IDLE) {
        willUnloadSet.add(actionToUnload);
      }
    }
  }

  // Step 2: Process preload, load, and reload sets
  collect_actions_to_preload_and_load: {
    const handleActionRequest = (
      action,
      requestType, // "preload", "load", or "reload"
    ) => {
      const isPreload = requestType === "preload";
      const isReload = requestType === "reload";

      if (action.loadingState === LOADING || action.loadingState === LOADED) {
        // Action is already loading/loaded
        // By default, we don't interfere with already active actions
        // Unless it's a reload or the action is also being unloaded
        if (isReload || willUnloadSet.has(action)) {
          // Force unload first, then reload/load
          willUnloadSet.add(action);
          if (isPreload) {
            willPreloadSet.add(action);
          } else {
            willLoadSet.add(action);
          }
        }
        // Otherwise, ignore the request (action stays as-is)
      } else if (isPreload) {
        willPreloadSet.add(action);
      } else {
        willLoadSet.add(action);
      }
    };

    // Process preloadSet (lowest priority)
    for (const actionToPreload of preloadSet) {
      if (loadSet.has(actionToPreload) || reloadSet.has(actionToPreload)) {
        // load/reload wins over preload - skip preload
        continue;
      }
      handleActionRequest(actionToPreload, "preload");
    }

    // Process loadSet (medium priority)
    for (const actionToLoad of loadSet) {
      if (reloadSet.has(actionToLoad)) {
        // reload wins over load - skip load
        continue;
      }
      if (!actionToLoad.loadRequested && actionToLoad.loadingState !== IDLE) {
        // Special case: action was preloaded but not yet requested to load
        // Just promote it to "load requested" without reloading
        willPromoteSet.add(actionToLoad);
        continue;
      }
      handleActionRequest(actionToLoad, "load");
    }

    // Process reloadSet (highest priority)
    for (const actionToReload of reloadSet) {
      handleActionRequest(actionToReload, "reload");
    }
  }
  const allThenableArray = [];
  const requestedThenableArray = [];

  // Step 3: Determine which actions will stay in their current state
  collect_actions_that_stay: {
    for (const actionLoading of loadingSet) {
      if (willUnloadSet.has(actionLoading)) {
        // will be unloaded (aborted), we don't want to wait
      } else if (
        willLoadSet.has(actionLoading) ||
        willPreloadSet.has(actionLoading)
      ) {
        // will be loaded, we'll wait for the new load promise
      } else {
        // an action that was loading and not affected by this update
        const actionPromise = actionPromiseMap.get(actionLoading);
        allThenableArray.push(actionPromise);
        staysLoadingSet.add(actionLoading);
      }
    }
    for (const actionLoaded of settledSet) {
      if (willUnloadSet.has(actionLoaded)) {
        // will be unloaded
      } else if (actionLoaded.loadingState === ABORTED) {
        staysAbortedSet.add(actionLoaded);
      } else if (actionLoaded.loadingState === FAILED) {
        staysFailedSet.add(actionLoaded);
      } else {
        staysLoadedSet.add(actionLoaded);
      }
    }
  }
  if (DEBUG) {
    const lines = [
      ...(willUnloadSet.size
        ? [formatActionSet("will unload", willUnloadSet)]
        : []),
      ...(willPreloadSet.size
        ? [formatActionSet("will preload", willPreloadSet)]
        : []),
      ...(willPromoteSet.size
        ? [formatActionSet("will promote", willPromoteSet)]
        : []),
      ...(willLoadSet.size ? [formatActionSet("will load", willLoadSet)] : []),
      ...(staysLoadingSet.size
        ? [formatActionSet("stays loading", staysLoadingSet)]
        : []),
      ...(staysAbortedSet.size
        ? [formatActionSet("stays aborted", staysAbortedSet)]
        : []),
      ...(staysFailedSet.size
        ? [formatActionSet("stays failed", staysFailedSet)]
        : []),
      ...(staysLoadedSet.size
        ? [formatActionSet("stays loaded", staysLoadedSet)]
        : []),
    ];
    console.debug(`operations that will be performed:
${lines.join("\n")}`);
  }

  // Step 4: Execute unloads
  execute_unloads: {
    for (const actionToUnload of willUnloadSet) {
      const actionToUnloadPrivateProperties =
        getActionPrivateProperties(actionToUnload);
      actionToUnloadPrivateProperties.performUnload({ reason });
      activationWeakSet.delete(actionToUnload);
    }
  }

  // Step 5: Execute preloads and loads
  execute_preloads_and_loads: {
    const onActionToLoadOrPreload = (actionToPreloadOrLoad, isPreload) => {
      if (import.meta.dev && actionToPreloadOrLoad.isProxy) {
        // maybe remove this check one the API is stable because
        // nothing in the API should allow this to happen
        throw new Error(
          `Proxy should not be reach this point, use the underlying action instead`,
        );
      }
      const actionSpecificSignal = abortSignalMap.get(actionToPreloadOrLoad);
      const effectiveSignal = actionSpecificSignal || abortSignal;

      const actionToLoadPrivateProperties = getActionPrivateProperties(
        actionToPreloadOrLoad,
      );
      const performLoadResult = actionToLoadPrivateProperties.performLoad({
        globalAbortSignal,
        abortSignal: effectiveSignal,
        reason,
        isPreload,
      });
      activationWeakSet.add(actionToPreloadOrLoad);

      if (performLoadResult && typeof performLoadResult.then === "function") {
        actionPromiseMap.set(actionToPreloadOrLoad, performLoadResult);
        requestedThenableArray.push(performLoadResult);
        allThenableArray.push(performLoadResult);
      } else {
        // sync actions are already done, no need to wait
      }
    };

    // Execute preloads
    for (const actionToPreload of willPreloadSet) {
      onActionToLoadOrPreload(actionToPreload, true);
    }

    // Execute loads
    for (const actionToLoad of willLoadSet) {
      onActionToLoadOrPreload(actionToLoad, false);
    }

    // Execute promotions (preload -> load requested)
    for (const actionToPromote of willPromoteSet) {
      const actionToPromotePrivateProperties =
        getActionPrivateProperties(actionToPromote);
      actionToPromotePrivateProperties.loadRequestedSignal.value = true;
    }
  }
  if (DEBUG) {
    console.groupEnd();
  }

  const requestedResult = requestedThenableArray.length
    ? Promise.all(requestedThenableArray)
    : null;
  const allResult = allThenableArray.length
    ? Promise.all(allThenableArray)
    : null;
  const loadingActionSet = new Set([...willPreloadSet, ...willLoadSet]);
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
      loadRequested = false,
      loadingState = IDLE,
      aborted = false,
      error = null,
      data,
      computedData,
      compute,
      renderLoadedAsync,
      sideEffect = () => {},
      keepOldData = false,
      meta = metaDefault,
    },
    { parentAction } = {},
  ) => {
    const initialData = data;
    const paramsSignal = signal(params);
    const loadRequestedSignal = signal(loadRequested);
    const loadingStateSignal = signal(loadingState);
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

    const preload = (options) => {
      return dispatchActions({
        preloadSet: new Set([action]),
        ...options,
      });
    };
    const load = (options) =>
      dispatchActions({
        loadSet: new Set([action]),
        ...options,
      });
    const reload = (options) => {
      return dispatchActions({
        reloadSet: new Set([action]),
        ...options,
      });
    };
    const unload = (options) =>
      dispatchActions({
        unloadSet: new Set([action]),
        ...options,
      });
    const abort = (reason) => {
      if (loadingState !== LOADING) {
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
      const childAction = createActionCore(
        {
          ...rootOptions,
          ...childOptions,
        },
        {
          parentAction: action,
        },
      );
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

    action = {
      callback,
      rootAction,
      parentAction,
      name: generateActionName(name, params),
      params,
      loadRequested,
      loadingState,
      aborted,
      error,
      data,
      computedData,
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
    };
    Object.preventExtensions(action);

    // Effects pour synchroniser les propriétés
    effects: {
      weakEffect([action], (actionRef) => {
        loadRequested = loadRequestedSignal.value;
        actionRef.loadRequested = loadRequested;
      });
      weakEffect([action], (actionRef) => {
        loadingState = loadingStateSignal.value;
        actionRef.loadingState = loadingState;
        aborted = loadingState === ABORTED;
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
      };
      let sideEffectCleanup;

      const performLoad = (loadParams) => {
        const { globalAbortSignal, abortSignal, reason, isPreload } =
          loadParams;

        if (isPreload) {
          preloadedProtectionRegistry.protect(action);
        }

        const internalAbortController = new AbortController();
        const internalAbortSignal = internalAbortController.signal;
        const abort = (abortReason) => {
          loadingStateSignal.value = ABORTED;
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
          loadingStateSignal.value = LOADING;
          if (!isPreload) {
            loadRequestedSignal.value = true;
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
          dataSignal.value = loadResult;
          loadingStateSignal.value = LOADED;
          preloadedProtectionRegistry.unprotect(action);
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          if (DEBUG) {
            console.log(`"${action}": loaded (reason: ${reason})`);
          }
        };
        const onLoadError = (e) => {
          console.error(e);
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbortFromSpecific);
          }
          if (globalAbortSignal) {
            globalAbortSignal.removeEventListener("abort", onAbortFromGlobal);
          }
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          if (internalAbortSignal.aborted && e === internalAbortSignal.reason) {
            loadingStateSignal.value = ABORTED;
            if (isPreload && abortSignal.aborted) {
              preloadedProtectionRegistry.unprotect(action);
            }
            return;
          }
          if (DEBUG) {
            console.log(`"${action}": failed (error: ${e})`);
          }
          batch(() => {
            errorSignal.value = e;
            loadingStateSignal.value = FAILED;
          });
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
            onLoadEnd();
            return undefined;
          }
          return Promise.all(thenableArray).then(() => {
            if (rejected) {
              onLoadError(rejectedValue);
            } else {
              onLoadEnd();
            }
          });
        } catch (e) {
          onLoadError(e);
          return undefined;
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
          loadRequestedSignal.value = false;
          loadingStateSignal.value = IDLE;
        });
      };

      const privateProperties = {
        initialData,

        paramsSignal,
        loadingStateSignal,
        loadRequestedSignal,
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
  let currentActionPrivateProperties;
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
    loadRequested: undefined,
    loadingState: undefined,
    aborted: undefined,
    error: undefined,
    data: undefined,
    computedData: undefined,
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
    actionProxy.loadRequested = currentAction.loadRequested;
    actionProxy.loadingState = currentAction.loadingState;
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
    loadRequestedSignal: proxyPrivateSignal(
      "loadRequestedSignal",
      "loadRequested",
    ),
    loadingStateSignal: proxyPrivateSignal(
      "loadingStateSignal",
      "loadingState",
    ),
    errorSignal: proxyPrivateSignal("errorSignal", "error"),
    dataSignal: proxyPrivateSignal("dataSignal", "data"),
    computedDataSignal: proxyPrivateSignal("computedDataSignal"),
    performLoad: proxyPrivateMethod("performLoad"),
    performUnload: proxyPrivateMethod("performUnload"),
  };

  onActionTargetChange(() => {
    proxyPrivateProperties.ui = currentActionPrivateProperties.ui;
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
        actionTargetPrevious.loadRequested
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
