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

let DEBUG = true;

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

// intermediate function representing the fact we'll use navigation.navigate update action and get a signal
export const requestActionsUpdates = ({
  preloadSet,
  loadSet,
  unloadSet,
  isReload,
  reason,
}) => {
  const signal = new AbortController().signal;
  const [
    requestedResult,
    // allDoneResult is the thing we'll return the the navigation api
    // so that it waits for every actions to consider things are done
    // allResult
  ] = updateActions({
    signal,
    preloadSet,
    loadSet,
    unloadSet,
    isReload,
    reason,
  });
  return requestedResult;
};
export const reloadActions = async (actionSet, { reason } = {}) => {
  return requestActionsUpdates({
    loadSet: actionSet,
    reason,
    isReload: true,
  });
};
export const abortPendingActions = (
  reason = "abortPendingActions was called",
) => {
  const { loadingSet } = getActivationInfo(); // ✅ Use new function
  for (const loadingAction of loadingSet) {
    loadingAction.abort(reason);
  }
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
  signal,
  isReload = false,
  isReplace = false,
  reason,
  preloadSet = new Set(),
  loadSet = new Set(),
  unloadSet = new Set(),
} = {}) => {
  if (!signal) {
    const abortController = new AbortController();
    signal = abortController.signal;
  }

  const { loadingSet, settledSet } = getActivationInfo();

  if (DEBUG) {
    console.group(`updateActions()`);
    const lines = [
      ...(preloadSet.size
        ? [`- preload requested: ${Array.from(preloadSet).join(", ")}`]
        : []),
      ...(loadSet.size
        ? [`- load requested: ${Array.from(loadSet).join(", ")}`]
        : []),
      ...(unloadSet.size
        ? [`- unload requested: ${Array.from(unloadSet).join(", ")}`]
        : []),
    ];
    console.debug(
      `${lines.join("\n")}
- meta: { reason: ${reason}, isReload: ${isReload}, isReplace ${isReplace} }`,
    );
  }
  const toUnloadSet = new Set();
  const toPreloadSet = new Set();
  const toLoadSet = new Set();
  const toPromoteSet = new Set();
  const staysLoadingSet = new Set();
  const staysAbortedSet = new Set();
  const staysFailedSet = new Set();
  const staysLoadedSet = new Set();
  list_to_unload: {
    for (const actionToUnload of unloadSet) {
      if (actionToUnload.loadingState !== IDLE) {
        toUnloadSet.add(actionToUnload);
      }
    }
  }
  list_to_preload_and_to_load: {
    const onActionToLoadOrPreload = (actionToLoadOrPreload, isPreload) => {
      if (
        actionToLoadOrPreload.loadingState === LOADING ||
        actionToLoadOrPreload.loadingState === LOADED
      ) {
        // by default when an action is already loading/loaded
        // requesting to load it does nothing so that:
        // - clicking a link already active in the UI does nothing
        // - requesting to load an action already pending does not abort + reload it
        //   (instead it stays pending)
        //   only trying to load this action with other params
        //   would abort the current one and load an other.
        // in order to load the same action code has to do one of:
        // - unload it first
        // - request unload + load at the same time
        // - use isReload: true when requesting the load of this action
        //   this is default when using action.load())
        if (isReload || toUnloadSet.has(actionToLoadOrPreload)) {
          toUnloadSet.add(actionToLoadOrPreload);
          if (isPreload) {
            toPreloadSet.add(actionToLoadOrPreload);
          } else {
            toLoadSet.add(actionToLoadOrPreload);
          }
        }
      } else if (isPreload) {
        toPreloadSet.add(actionToLoadOrPreload);
      } else {
        toLoadSet.add(actionToLoadOrPreload);
      }
    };
    for (const actionToPreload of preloadSet) {
      if (loadSet.has(actionToPreload)) {
        // load wins over preload
        continue;
      }
      onActionToLoadOrPreload(actionToPreload, true);
    }
    for (const actionToLoad of loadSet) {
      if (!actionToLoad.loadRequested && actionToLoad.loadingState !== IDLE) {
        // was preloaded but is not requested to load
        // -> can move to load requested
        toPromoteSet.add(actionToLoad);
        continue;
      }
      onActionToLoadOrPreload(actionToLoad, false);
    }
  }
  const allThenableArray = [];
  const requestedThenableArray = [];
  list_stays_loading_and_stays_loaded: {
    for (const actionLoading of loadingSet) {
      if (toUnloadSet.has(actionLoading)) {
        // will be unloaded (aborted), we don't want to wait
      } else if (
        toLoadSet.has(actionLoading) ||
        toPreloadSet.has(actionLoading)
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
      if (toUnloadSet.has(actionLoaded)) {
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

    const lines = [
      ...(toUnloadSet.size ? [formatActionSet("to unload", toUnloadSet)] : []),
      ...(toPreloadSet.size
        ? [formatActionSet("to preload", toPreloadSet)]
        : []),
      ...(toPromoteSet.size
        ? [formatActionSet("to promote", toPromoteSet)]
        : []),
      ...(toLoadSet.size ? [formatActionSet("to load", toLoadSet)] : []),
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
    console.debug(`situation before updating actions:
${lines.join("\n")}`);
  }

  peform_unloads: {
    for (const actionToUnload of toUnloadSet) {
      const actionToUnloadPrivateProperties =
        getActionPrivateProperties(actionToUnload);
      actionToUnloadPrivateProperties.performUnload({ reason });
      activationWeakSet.delete(actionToUnload);
    }
  }
  perform_preloads_and_loads: {
    const onActionToLoadOrPreload = (actionToPreloadOrLoad, isPreload) => {
      if (import.meta.dev && actionToPreloadOrLoad.isProxy) {
        // maybe remove this check one the API is stable because
        // nothing in the API should allow this to happen
        throw new Error(
          `Proxy should not be reach this point, use the underlying action instead`,
        );
      }
      const actionToLoadPrivateProperties = getActionPrivateProperties(
        actionToPreloadOrLoad,
      );
      const performLoadResult = actionToLoadPrivateProperties.performLoad({
        signal,
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
    for (const actionToPreload of toPreloadSet) {
      onActionToLoadOrPreload(actionToPreload, true);
    }
    for (const actionToLoad of toLoadSet) {
      onActionToLoadOrPreload(actionToLoad, false);
    }
    for (const actionToPromote of toPromoteSet) {
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
  return [requestedResult, allResult];
};

const initialParamsDefault = {};
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
      return requestActionsUpdates({
        preloadSet: new Set([action]),
        ...options,
      });
    };
    const load = (options) =>
      requestActionsUpdates({
        loadSet: new Set([action]),
        ...options,
      });
    const reload = (options) => {
      return load({ isReload: true, ...options });
    };
    const unload = () =>
      requestActionsUpdates({
        unloadSet: new Set([action]),
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
      toString: () => name,
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
        const { signal, reason, isPreload } = loadParams;

        if (isPreload) {
          preloadedProtectionRegistry.protect(action);
        }

        const abortController = new AbortController();
        const abortSignal = abortController.signal;
        const abort = (abortReason) => {
          loadingStateSignal.value = ABORTED;
          abortController.abort(abortReason);
          actionAbortMap.delete(action);
          if (isPreload && signal.aborted) {
            preloadedProtectionRegistry.unprotect(action);
          }
          if (DEBUG) {
            console.log(`"${action}": aborted (reason: ${abortReason})`);
          }
        };
        const onabort = () => {
          abort(signal.reason);
        };
        signal.addEventListener("abort", onabort);
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
        args.push({ signal: abortSignal, reason, isPreload });
        const returnValue = sideEffect(...args);
        if (typeof returnValue === "function") {
          sideEffectCleanup = returnValue;
        }

        let loadResult;
        let rejected = false;
        let rejectedValue;
        const onLoadEnd = () => {
          signal.removeEventListener("abort", onabort);
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
          signal.removeEventListener("abort", onabort);
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          if (abortSignal.aborted && e === abortSignal.reason) {
            loadingStateSignal.value = ABORTED;
            if (isPreload && signal.aborted) {
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
  };
  let actionTarget = null;
  let currentAction = action;
  let currentActionPrivateProperties;

  const proxyMethod = (method) => {
    return (...args) => currentAction[method](...args);
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
    let actionTargetPreviousWeakRef = null;
    let isFirstEffect = true;
    const changeCleanupCallbackSet = new Set();

    weakEffect([action], (actionRef) => {
      const previousTarget = actionTargetPreviousWeakRef?.deref();
      const params = proxyParamsSignal.value;

      if (params === undefined) {
        actionTarget = null;
        currentAction = actionRef;
        currentActionPrivateProperties = getActionPrivateProperties(actionRef);
      } else {
        actionTarget = actionRef.bindParams(params);
        if (previousTarget === actionTarget) {
          // replaceParams might have updated the currentAction name
          nameSignal.value = `[Proxy] ${currentAction.name}`;
          return;
        }
        currentAction = actionTarget;
        currentActionPrivateProperties =
          getActionPrivateProperties(actionTarget);
      }

      if (isFirstEffect) {
        isFirstEffect = false;
      }
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
      actionTargetPreviousWeakRef = actionTarget
        ? new WeakRef(actionTarget)
        : null;
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
  const args = [];
  if (params === null || typeof params !== "object") {
    args.push(stringifyForDisplay(params));
  } else {
    const keys = Object.keys(params);
    if (keys.length === 0) {
    } else {
      args.push(stringifyForDisplay(params));
    }
  }
  const nameWithParams = args.length ? `${name}(${args.join(", ")})` : name;
  return nameWithParams;
};

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // important sinon les actions ne se mettent pas a jour
    // par example action.ui.load DOIT etre appelé
    // pour que ui.renderLoaded soit la
    if (DEBUG) {
      console.debug("updateActions() on hot reload");
    }
    updateActions({ isReload: true });
  });
}
