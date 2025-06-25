import { batch, computed, effect, signal } from "@preact/signals";
import {
  getActionPrivateProperties,
  setActionPrivateProperties,
} from "./action_private_properties.js";
import { isSignal, stringifyForDisplay } from "./actions_helpers.js";
import { createJsValueWeakMap } from "./js_value_weak_map.js";

let debug = true;

export const IDLE = { id: "idle" };
export const LOADING = { id: "loading" };
export const ABORTED = { id: "aborted" };
export const FAILED = { id: "failed" };
export const LOADED = { id: "loaded" };

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
      if (debug) {
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
        if (debug) {
          console.debug(
            `"${action}": preload protection expired after ${PROTECTION_DURATION}ms`,
          );
        }
      }, PROTECTION_DURATION);

      protectedActionMap.set(action, { timeoutId, timestamp });

      if (debug) {
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
  return updateActions({
    signal,
    preloadSet,
    loadSet,
    unloadSet,
    isReload,
    reason,
  });
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
  const { loadingSet } = activationRegistry.getInfo();
  const unloadSet = loadingSet;
  return requestActionsUpdates({
    unloadSet,
    reason,
  });
};

const actionAbortMap = new Map();
const actionPromiseMap = new Map();
const activationRegistry = (() => {
  const actionToIdMap = new WeakMap();
  const idToActionMap = new Map();
  let nextId = 1;

  return {
    add(action) {
      let id = actionToIdMap.get(action);
      if (id === undefined) {
        id = nextId++;
        actionToIdMap.set(action, id);
      }
      idToActionMap.set(id, new WeakRef(action));
    },

    delete(action) {
      const id = actionToIdMap.get(action);
      if (id !== undefined) {
        idToActionMap.delete(id);
      }
    },

    has(action) {
      const id = actionToIdMap.get(action);
      if (id === undefined) {
        return false;
      }

      const weakRef = idToActionMap.get(id);
      const actionRef = weakRef?.deref();

      if (!actionRef) {
        idToActionMap.delete(id);
        return false;
      }

      return true;
    },

    getInfo() {
      const loadingSet = new Set();
      const settledSet = new Set();

      for (const [id, weakRef] of idToActionMap) {
        const action = weakRef.deref();
        if (!action) {
          idToActionMap.delete(id);
          continue;
        }
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
            `An action in the activation registry must be LOADING, ABORTED, FAILED or LOADED, found "${loadingState.id}" for action "${action}"`,
          );
        }
      }
      return {
        loadingSet,
        settledSet,
      };
    },

    clear() {
      idToActionMap.clear();
    },
  };
})();

if (import.meta.dev) {
  window.__actions__ = {
    activationRegistry,
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

  const { loadingSet, settledSet } = activationRegistry.getInfo();

  if (debug) {
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
        //   this is default when using action.load()
        if (isReload || toUnloadSet.has(actionToLoadOrPreload)) {
          toUnloadSet.add(actionToLoadOrPreload);
          if (isPreload) {
            toPreloadSet.add(actionToLoadOrPreload);
          } else {
            toLoadSet.add(actionToLoadOrPreload);
          }
        } else {
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
        // -> can move to load requested state no matter the loading state
        toPromoteSet.add(actionToLoad);
        continue;
      }
      onActionToLoadOrPreload(actionToLoad, false);
    }
  }
  const thenableArray = [];
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
        thenableArray.push(actionPromise);
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
  if (debug) {
    const lines = [
      ...(toUnloadSet.size
        ? [`- to unload: ${Array.from(toUnloadSet).join(", ")}`]
        : []),
      ...(toPreloadSet.size
        ? [`- to preload: ${Array.from(toPreloadSet).join(", ")}`]
        : []),
      ...(toPromoteSet.size
        ? [`- to promote: ${Array.from(toPromoteSet).join(", ")}`]
        : []),
      ...(toLoadSet.size
        ? [`- to load: ${Array.from(toLoadSet).join(", ")}`]
        : []),
      ...(staysLoadingSet.size
        ? [`- stays loading: ${Array.from(staysLoadingSet).join(", ")}`]
        : []),
      ...(staysAbortedSet.size
        ? [`- stays aborted: ${Array.from(staysAbortedSet).join(", ")}`]
        : []),
      ...(staysFailedSet.size
        ? [`- stays failed: ${Array.from(staysFailedSet).join(", ")}`]
        : []),
      ...(staysLoadedSet.size
        ? [`- stays loaded: ${Array.from(staysLoadedSet).join(", ")}`]
        : []),
    ];
    console.debug(`situation before updating actions:
${lines.join("\n")}`);
  }

  peform_unloads: {
    for (const actionToUnload of toUnloadSet) {
      const actionToUnloadPrivateProperties =
        getActionPrivateProperties(actionToUnload);
      actionToUnloadPrivateProperties.performUnload(reason);
      activationRegistry.delete(actionToUnload);
    }
  }
  perform_preloads_and_loads: {
    const onActionToLoadOrPreload = (actionToPreloadOrLoad, isPreload) => {
      const actionToLoadPrivateProperties = getActionPrivateProperties(
        actionToPreloadOrLoad,
      );
      const loadPromise = actionToLoadPrivateProperties.performLoad({
        signal,
        reason,
        isPreload,
      });
      activationRegistry.add(actionToPreloadOrLoad);
      if (
        // sync actions are already done, no need to wait for activate promise
        actionToPreloadOrLoad.loadingState === LOADED
      ) {
      } else {
        actionPromiseMap.set(actionToPreloadOrLoad, loadPromise);
        thenableArray.push(loadPromise);
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
  if (debug) {
    console.groupEnd();
  }
  if (thenableArray.length) {
    return Promise.all(thenableArray);
  }
  return null;
};

const initialParamsDefault = {};
const metaDefault = {};

export const createAction = (callback, rootOptions) => {
  let rootAction;

  const createActionCore = (
    {
      name = callback.name || "anonymous",
      params = initialParamsDefault,
      loadRequested = false,
      loadingState = IDLE,
      error = null,
      data,
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

    const preload = () => {
      return requestActionsUpdates({
        preloadSet: new Set([action]),
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
    const abort = () => {
      if (loadingState !== LOADING) {
        return undefined;
      }
      return requestActionsUpdates({
        unloadSet: new Set([action]),
      });
    };

    let action;

    const childActionWeakRefSet = new Set();
    const childActionRegistry = new FinalizationRegistry(() => {
      for (const weakRef of childActionWeakRefSet) {
        if (weakRef.deref() === undefined) {
          childActionWeakRefSet.delete(weakRef);
        }
      }
    });

    const childActionWeakMap = createJsValueWeakMap();
    const _bindParams = (newParamsOrSignal, options = {}) => {
      // ✅ CAS 1: Signal direct -> proxy
      if (isSignal(newParamsOrSignal)) {
        const combinedParamsSignal = computed(() => {
          const newParams = newParamsOrSignal.value;

          if (newParams === null || typeof newParams !== "object") {
            return newParams;
          }

          if (params === null || typeof params !== "object") {
            return newParams;
          }

          return { ...params, ...newParams };
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
            staticParams[key] = value;
          }
        }

        if (signalMap.size === 0) {
          // Pas de signals, merge statique normal
          if (params === null || typeof params !== "object") {
            return createChildAction(newParamsOrSignal, options);
          }
          const combinedParams = { ...params, ...newParamsOrSignal };
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

      const childWeakRef = new WeakRef(childAction);
      childActionWeakRefSet.add(childWeakRef);
      childActionRegistry.register(childAction);

      return childAction;
    };

    const createChildAction = (childOptions) => {
      const childParams = childOptions.params;
      const args = [];
      if (childParams === null || typeof childParams !== "object") {
        args.push(childParams);
      } else {
        const keys = Object.keys(childParams);
        if (keys.length === 0) {
        } else {
          args.push(stringifyForDisplay(childParams));
        }
      }
      const childName = args.length ? `${name}(${args.join(", ")})` : name;
      const childAction = createActionCore(
        {
          ...rootOptions,
          name: childName,
          ...childOptions,
        },
        {
          parentAction: action,
        },
      );

      const childWeakRef = new WeakRef(childAction);
      childActionWeakRefSet.add(childWeakRef);
      childActionRegistry.register(childAction);

      return childAction;
    };

    // ✅ Implement matchAllSelfOrDescendant
    const matchAllSelfOrDescendant = (predicate, { includeProxies } = {}) => {
      const matches = [];

      const traverse = (currentAction) => {
        if (action.isProxy && !includeProxies) {
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
        const childActionWeakRefSet =
          currentActionPrivateProps.childActionWeakRefSet;
        // Traverse live child actions
        for (const childWeakRef of childActionWeakRefSet) {
          const childAction = childWeakRef.deref();
          if (!childAction) {
            childActionWeakRefSet.delete(childWeakRef);
            continue;
          }
          traverse(childAction);
        }
      };

      traverse(action);
      return matches;
    };

    action = {
      rootAction,
      parentAction,
      name,
      params,
      loadingState,
      loadRequested,
      error,
      data,
      preload,
      load,
      reload,
      unload,
      abort,
      bindParams,
      matchAllSelfOrDescendant, // ✅ Add the new method
      toString: () => name,
      meta,
    };
    Object.preventExtensions(action);

    // Effects pour synchroniser les propriétés
    effects: {
      const actionWeakRef = new WeakRef(action);
      const actionWeakEffect = (callback) => {
        const dispose = effect(() => {
          const actionRef = actionWeakRef.deref();
          if (actionRef) {
            callback(actionRef);
          } else {
            dispose();
          }
        });
      };
      actionWeakEffect((actionRef) => {
        loadRequested = loadRequestedSignal.value;
        actionRef.loadRequested = loadRequested;
      });
      actionWeakEffect((actionRef) => {
        loadingState = loadingStateSignal.value;
        actionRef.loadingState = loadingState;
      });
      actionWeakEffect((actionRef) => {
        error = errorSignal.value;
        actionRef.error = error;
      });
      actionWeakEffect((actionRef) => {
        data = dataSignal.value;
        actionRef.data = data;
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
          if (debug) {
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

        const args = [params, { signal: abortSignal, reason, isPreload }];
        const returnValue = sideEffect(...args);
        if (typeof returnValue === "function") {
          sideEffectCleanup = returnValue;
        }

        let loadResult;
        const onLoadEnd = () => {
          dataSignal.value = loadResult;
          loadingStateSignal.value = LOADED;
          preloadedProtectionRegistry.unprotect(action);
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          if (debug) {
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
          batch(() => {
            errorSignal.value = e;
            loadingStateSignal.value = FAILED;
          });
          if (debug) {
            console.log(`"${action}": failed (error: ${e})`);
          }
        };

        try {
          const thenableArray = [];
          const callbackResult = callback(...args);
          if (callbackResult && typeof callbackResult.then === "function") {
            thenableArray.push(callbackResult);
            callbackResult.then((value) => {
              loadResult = value;
            });
          } else {
            loadResult = callbackResult;
          }
          if (ui.renderLoadedAsync && !ui.renderLoaded) {
            const renderLoadedPromise = ui
              .renderLoadedAsync(...args)
              .then((renderLoaded) => {
                ui.renderLoaded = renderLoaded;
              });
            thenableArray.push(renderLoadedPromise);
          }
          if (thenableArray.length === 0) {
            onLoadEnd();
            return undefined;
          }
          return Promise.all(thenableArray).then(
            () => {
              onLoadEnd();
            },
            (e) => {
              onLoadError(e);
            },
          );
        } catch (e) {
          onLoadError(e);
        }
        return undefined;
      };

      const performUnload = (reason) => {
        const abort = actionAbortMap.get(action);
        if (abort) {
          if (debug) {
            console.log(`"${action}": aborting (reason: ${reason})`);
          }
          abort(reason);
        } else if (debug) {
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

        childActionWeakRefSet,
      };
      setActionPrivateProperties(action, privateProperties);
    }

    return action;
  };

  rootAction = createActionCore(rootOptions);
  return rootAction;
};

export const useActionStatus = (action) => {
  const {
    paramsSignal,
    loadingStateSignal,
    loadRequestedSignal,
    errorSignal,
    computedDataSignal,
  } = getActionPrivateProperties(action);

  const params = paramsSignal.value;
  const loadRequested = loadRequestedSignal.value;
  const loadingState = loadingStateSignal.value;
  const error = errorSignal.value;
  const idle = loadingState === IDLE;
  const pending = loadingState === LOADING;
  const aborted = loadingState === ABORTED;
  const preloaded = loadingState === LOADED && !loadRequested;
  const data = computedDataSignal.value;

  return {
    params,
    idle,
    error,
    aborted,
    pending,
    preloaded,
    data,
  };
};

const createActionProxyFromSignal = (
  action,
  paramsSignal,
  { reloadOnChange = true, onChange } = {},
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
  const actionProxy = {
    isProxy: true,
    name: undefined,
    params: undefined,
    loadRequested: undefined,
    loadingState: undefined,
    error: undefined,
    data: undefined,
    preload: proxyMethod("preload"),
    load: proxyMethod("load"),
    reload: proxyMethod("reload"),
    unload: proxyMethod("unload"),
    matchAllSelfOrDescendant: proxyMethod("matchAllSelfOrDescendant"),
    toString: () => actionProxy.name,
  };
  Object.preventExtensions(actionProxy);

  onActionTargetChange((actionTarget) => {
    const currentAction = actionTarget || action;
    actionProxy.name = `[Proxy] ${currentAction.name}`;
    actionProxy.params = currentAction.params;
    actionProxy.loadRequested = currentAction.loadRequested;
    actionProxy.loadingState = currentAction.loadingState;
    actionProxy.error = currentAction.error;
    actionProxy.data = currentAction.data;
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
  const proxyPrivateProperties = {
    paramsSignal,
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
    proxyPrivateProperties.childActionWeakRefSet =
      currentActionPrivateProperties.childActionWeakRefSet;
  });
  setActionPrivateProperties(actionProxy, proxyPrivateProperties);

  {
    let actionTargetPrevious = null;
    let isFirstEffect = true;
    const changeCleanupCallbackSet = new Set();
    const actionWeakRef = new WeakRef(action);
    const proxyWeakRef = new WeakRef(actionProxy);

    const dispose = effect(() => {
      const actionRef = actionWeakRef.deref();
      const proxyRef = proxyWeakRef.deref();
      if (!actionRef || !proxyRef) {
        dispose();
        return;
      }

      const previousTarget = actionTargetPrevious;
      const params = paramsSignal.value;
      if (params) {
        actionTarget = actionRef.bindParams(params);
        currentAction = actionTarget;
        currentActionPrivateProperties =
          getActionPrivateProperties(actionTarget);
      } else {
        actionTarget = null;
        currentAction = actionRef;
        currentActionPrivateProperties = getActionPrivateProperties(actionRef);
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
      actionTargetPrevious = actionTarget; // ✅ Store for next time but this is the only reference
    });
  }

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

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // important sinon les actions ne se mettent pas a jour
    // par example action.ui.load DOIT etre appelé
    // pour que ui.renderLoaded soit la
    if (debug) {
      console.debug("updateActions() on hot reload");
    }
    updateActions({ isReload: true });
  });
}
