/**
 * # Actions System - Declarative Resource Management for Frontend Applications
 *
 * This module provides a comprehensive system for managing asynchronous resources (API calls, data fetching)
 * in a declarative, signal-based architecture. It's designed for complex frontend applications that need
 * fine-grained control over loading states, caching, and resource lifecycle management.
 *
 * ## Core Concepts
 *
 * ### 🔧 **Action Templates**
 * Factory functions that define how to load resources. Templates are pure and reusable.
 * ```js
 * const getUserTemplate = createActionTemplate(async ({ userId }) => {
 *   const response = await fetch(`/api/users/${userId}`);
 *   return response.json();
 * });
 * ```
 *
 * ### 🎯 **Action Instances**
 * Stateful objects created from templates with specific parameters. Each unique parameter set
 * gets its own cached instance (automatic memoization).
 * ```js
 * const userAction = getUserTemplate.instantiate({ userId: 123 });
 * const status = useActionStatus(userAction); // { pending, data, error, ... }
 * ```
 *
 * ### 🔄 **Action Proxies**
 * Dynamic actions that react to signal changes, automatically reloading when parameters change.
 * ```js
 * const userProxy = createActionProxy(getUserTemplate, {
 *   userId: userIdSignal,     // Signal - reactive
 *   includeProfile: true      // Static - not reactive
 * });
 * // Automatically reloads when userIdSignal changes
 * ```
 *
 * ## Loading States & Lifecycle
 *
 * ### 📊 **State Management**
 * Each action has a well-defined state machine:
 * - `IDLE` → `LOADING` → `LOADED` (success)
 * - `IDLE` → `LOADING` → `FAILED` (error)
 * - `IDLE` → `LOADING` → `ABORTED` (cancelled)
 *
 * ### ⚡ **Load Types**
 * - **`.load()`** - Load with user intent (sets `loadRequested: true`)
 * - **`.preload()`** - Background loading (sets `loadRequested: false`)
 * - **`.reload()`** - Force reload even if already loaded
 * - **`.unload()`** - Cancel loading and reset state
 *
 * ### 🛡️ **Preload Protection**
 * Preloaded actions are protected from garbage collection for 5 minutes to ensure
 * they remain available for components that may load later (e.g., via dynamic imports).
 *
 * ## Key Features
 *
 * ### 🧠 **Intelligent Memoization**
 * - Actions with identical parameters share the same instance
 * - Uses deep equality comparison with `compareTwoJsValues`
 * - Supports `SYMBOL_IDENTITY` for fast recognition of "conceptually same" objects
 * - Memory-efficient with automatic garbage collection
 *
 * ### 🔗 **Parameter Binding & Composition**
 * ```js
 * const baseAction = getUserTemplate.instantiate({ userId: 123 });
 * const enrichedAction = baseAction.bindParams({ includeProfile: true });
 * // Result: { userId: 123, includeProfile: true }
 *
 * // Supports objects, primitives, and signals
 * const dynamicAction = baseAction.bindParams(filtersSignal);
 * ```
 *
 * ### 🎮 **Concurrent Loading Control**
 * - Prevents duplicate requests for same resource
 * - Smart request deduplication and racing condition handling
 * - Coordinated loading/unloading of multiple actions via `updateActions()`
 *
 * ### 🔧 **Side Effects & Cleanup**
 * ```js
 * const actionTemplate = createActionTemplate(callback, {
 *   sideEffect: (params, loadParams) => {
 *     // Setup logic (analytics, subscriptions, etc.)
 *     return () => {
 *       // Cleanup logic - called on unload/abort
 *     };
 *   }
 * });
 * ```
 *
 * ## Usage Patterns
 *
 * ### 🏗️ **Basic Resource Loading**
 * ```js
 * const getUserAction = createActionTemplate(async ({ userId }) => {
 *   return await api.getUser(userId);
 * });
 *
 * // In component
 * const userAction = getUserAction.instantiate({ userId: 123 });
 * const { pending, data, error } = useActionStatus(userAction);
 *
 * useEffect(() => {
 *   userAction.load();
 * }, []);
 * ```
 *
 * ### 🔄 **Reactive Data Loading**
 * ```js
 * const searchProxy = createActionProxy(searchTemplate, {
 *   query: searchSignal,
 *   filters: filtersSignal
 * });
 * // Automatically reloads when signals change
 * ```
 *
 * ### 📋 **Master-Detail Pattern**
 * ```js
 * const usersAction = getUsersTemplate.instantiate();
 * const selectedUser = signal(null);
 *
 * const userDetailsProxy = createActionProxy(getUserTemplate, {
 *   userId: computed(() => selectedUser.value?.id)
 * });
 * ```
 *
 * ### 🏃 **Progressive Loading**
 * ```js
 * // Preload on hover, load on click
 * <button
 *   onMouseEnter={() => action.preload()}
 *   onClick={() => action.load()}
 * >
 *   Load User
 * </button>
 * ```
 *
 * ## Advanced Features
 *
 * ### 🎭 **Custom Data Transformation**
 * ```js
 * const actionTemplate = createActionTemplate(fetchUser, {
 *   computedDataSignal: computed(() => {
 *     const rawData = dataSignal.value;
 *     return rawData ? transformUser(rawData) : null;
 *   })
 * });
 * ```
 *
 * ### 🎨 **Async Rendering Support**
 * ```js
 * const actionTemplate = createActionTemplate(fetchData, {
 *   renderLoadedAsync: async () => {
 *     const { UserComponent } = await import('./UserComponent.js');
 *     return (user) => <UserComponent user={user} />;
 *   }
 * });
 * ```
 *
 * ### 🛠️ **Debugging & Observability**
 * Built-in debug mode with detailed logging of state transitions, loading coordination,
 * and memory management. Enable with `debug = true`.
 *
 * ## Integration Points
 *
 * - **Signals**: Built on @preact/signals for reactive state management
 * - **Navigation**: Integrates with navigation systems for route-based loading
 * - **Components**: Use `useActionStatus()` hook for component integration
 * - **Memory Management**: Automatic cleanup with WeakMap-based private properties
 *
 * ## Performance Characteristics
 *
 * - **Memory Efficient**: Weak references prevent memory leaks
 * - **Request Deduplication**: Identical requests are automatically merged
 * - **Minimal Re-renders**: Signal-based updates only trigger when data actually changes
 * - **Lazy Loading**: Actions only created when needed, with intelligent memoization
 *
 * This system is particularly well-suited for:
 * - SPAs with complex data fetching requirements
 * - Applications needing fine-grained loading state control
 * - Systems requiring request coordination and deduplication
 * - Progressive loading and preloading scenarios
 * - Master-detail interfaces with dynamic parameter binding
 */

import { batch, computed, effect, signal } from "@preact/signals";
import { stringifyForDisplay } from "./actions_helpers.js";
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
      const loadedSet = new Set();

      for (const [id, weakRef] of idToActionMap) {
        const action = weakRef.deref();
        if (action) {
          if (action.loadingState === LOADING) {
            loadingSet.add(action);
          } else if (action.loadingState === LOADED) {
            loadedSet.add(action);
          } else {
            throw new Error(
              `An action in the activation registry should be LOADING or LOADED, but got "${action.loadingState.id}" for action "${action.name}"`,
            );
          }
        } else {
          idToActionMap.delete(id);
        }
      }
      return {
        loadingSet,
        loadedSet,
      };
    },

    clear() {
      idToActionMap.clear();
    },
  };
})();

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

  const { loadingSet, loadedSet } = activationRegistry.getInfo();

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
    for (const actionLoaded of loadedSet) {
      if (toUnloadSet.has(actionLoaded)) {
        // will be unloaded
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
const actionPrivatePropertiesWeakMap = new WeakMap();
export const getActionPrivateProperties = (action) => {
  const actionPrivateProperties = actionPrivatePropertiesWeakMap.get(action);
  if (!actionPrivateProperties) {
    throw new Error(`Cannot find action private properties for "${action}"`);
  }
  return actionPrivateProperties;
};

const itemAsHumanString = (item) => {
  if (!item) {
    return String(item);
  }
  const toString = item.toString;
  if (toString !== Object.prototype.toString) {
    return item.toString();
  }
  if (Object.hasOwn(item, "name")) {
    return item.name;
  }
  if (Object.hasOwn(item, "id")) {
    return item.id;
  }
  const toStringTag = item[Symbol.toStringTag];
  if (toStringTag) {
    return toStringTag;
  }
  return toString(item);
};

export const createActionTemplate = (
  callback,
  {
    name = callback.name || "anonymous",
    params: initialParams = initialParamsDefault,
    loadRequested: initialLoadRequested = false,
    loadingState: initialLoadingState = IDLE,
    error: initialError = null,
    data: initialData,
    computedDataSignal,
    renderLoadedAsync,
    sideEffect = () => {},
    keepOldData = false,
  } = {},
) => {
  const _instantiate = (instanceParams = initialParams) => {
    let item;
    let params;
    if (instanceParams && typeof instanceParams === "object") {
      ({ item, ...params } = instanceParams);
    } else {
      item = undefined;
      params = instanceParams;
    }

    let instanceName = name;
    const args = [];
    if (item) {
      args.push(itemAsHumanString(item));
    }
    if (params === null || typeof params !== "object") {
      args.push(params);
    } else {
      const keys = Object.keys(params);
      if (keys.length === 0) {
      } else {
        args.push(stringifyForDisplay(params));
      }
    }
    if (args.length) {
      instanceName = `${name}(${args.join(", ")})`;
    }

    const paramsSignal = signal(params);

    let loadRequested = initialLoadRequested;
    const loadRequestedSignal = signal(loadRequested);
    let loadingState = initialLoadingState;
    const loadingStateSignal = signal(loadingState);
    let error = initialError;
    const errorSignal = signal(error);
    let data = initialData;
    const dataSignal = signal(initialData);

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

    const bindParams = (newParamsOrSignal, options) => {
      if (instanceParams === initialParamsDefault) {
        return createActionProxy(action, newParamsOrSignal, options);
      }

      if (isSignal(newParamsOrSignal)) {
        const combinedParamsSignal = computed(() => {
          const newParams = newParamsOrSignal.value;

          if (newParams === null || typeof newParams !== "object") {
            return newParams;
          }

          if (instanceParams === null || typeof instanceParams !== "object") {
            return newParams;
          }

          return { ...instanceParams, ...newParams };
        });
        return createActionProxy(action, combinedParamsSignal, options);
      }

      if (newParamsOrSignal && typeof newParamsOrSignal === "object") {
        if (instanceParams === null || typeof instanceParams !== "object") {
          // Params existants primitifs -> remplacés par l'objet
          return createActionProxy(action, newParamsOrSignal, options);
        }
        const combinedParams = { ...instanceParams, ...newParamsOrSignal };
        return createActionProxy(action, combinedParams, options);
      }

      // Primitive
      return createActionProxy(action, newParamsOrSignal, options);
    };

    const action = {
      template: actionTemplate,
      name: instanceName,
      params,
      loadingState,
      loadRequested,
      error,
      data,
      preload,
      load,
      reload,
      unload,
      bindParams,
      toString: () => instanceName,
    };
    Object.preventExtensions(action);
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
    private_properties: {
      const ui = {
        renderLoaded: null,
        renderLoadedAsync,
      };
      let sideEffectCleanup;
      const performLoad = (loadParams) => {
        const {
          signal,
          // reason,
          isPreload,
        } = loadParams;

        if (isPreload) {
          preloadedProtectionRegistry.protect(action);
        }

        const abortController = new AbortController();
        const abortSignal = abortController.signal;
        const abort = (reason) => {
          if (debug) {
            console.log(`"${action}": abort activation.`);
          }
          loadingStateSignal.value = ABORTED;
          abortController.abort(reason);
          actionAbortMap.delete(action);
          if (isPreload) {
            preloadedProtectionRegistry.unprotect(action);
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

        const args = [params, loadParams];
        const returnValue = sideEffect(...args);
        if (typeof returnValue === "function") {
          sideEffectCleanup = returnValue;
        }

        let loadResult;
        const onLoadEnd = () => {
          dataSignal.value = loadResult;
          loadingStateSignal.value = LOADED;
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
        };
        const onLoadError = (e) => {
          console.error(e);
          signal.removeEventListener("abort", onabort);
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          if (abortSignal.aborted && e === abortSignal.reason) {
            if (isPreload) {
              preloadedProtectionRegistry.unprotect(action);
            }
            loadingStateSignal.value = ABORTED;
            return;
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
            thenableArray.push(callbackResult);
            callbackResult.then((value) => {
              loadResult = value;
            });
          } else {
            loadResult = callbackResult;
          }
          const renderLoadedAsync = ui.renderLoadedAsync;
          if (renderLoadedAsync) {
            const renderLoadedPromise = renderLoadedAsync(...args).then(
              (renderLoaded) => {
                ui.renderLoaded = () => renderLoaded;
              },
            );
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
          console.log(`"${action}": unload route (reason: ${reason})`);
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
        initialLoadRequested,
        initialLoadingState,
        initialParams: instanceParams,
        initialData,
        initialError,

        paramsSignal,
        loadingStateSignal,
        loadRequestedSignal,
        dataSignal,
        computedDataSignal: computedDataSignal || dataSignal,
        errorSignal,

        performLoad,
        performUnload,
        ui,
      };
      actionPrivatePropertiesWeakMap.set(action, privateProperties);
    }
    return action;
  };

  const actionParamsWeakMap = createJsValueWeakMap();
  const memoizedInstantiate = (params, options) => {
    const actionForParams = actionParamsWeakMap.get(params);
    if (actionForParams) {
      return actionForParams;
    }
    const action = _instantiate(params, options);
    actionParamsWeakMap.set(params, action);
    return action;
  };

  const actionTemplate = {
    isTemplate: true,
    name,
    initialParams,
    initialLoadingState,
    initialLoadRequested,
    initialError,
    initialData,
    instantiate: memoizedInstantiate,
  };

  return actionTemplate;
};

export const createAction = (callback, options) => {
  return createActionTemplate(callback, options).instantiate();
};

export const createActionProxy = (action, paramsMapOrSignal, options = {}) => {
  const actionTemplate = action.isTemplate ? action : action.template;

  if (isSignal(paramsMapOrSignal)) {
    return createActionProxyFromSignal(
      actionTemplate,
      paramsMapOrSignal,
      options,
    );
  }

  if (paramsMapOrSignal && typeof paramsMapOrSignal === "object") {
    const staticParams = {};
    const signalMap = new Map();

    const keyArray = Object.keys(paramsMapOrSignal);
    for (const key of keyArray) {
      const value = paramsMapOrSignal[key];
      if (isSignal(value)) {
        signalMap.set(key, value);
      } else {
        staticParams[key] = value;
      }
    }

    if (signalMap.size === 0) {
      return actionTemplate.instantiate(paramsMapOrSignal);
    }

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
    return createActionProxyFromSignal(actionTemplate, paramsSignal, options);
  }

  // Valeur primitive
  const paramsSignal = signal(paramsMapOrSignal);
  return createActionProxyFromSignal(actionTemplate, paramsSignal, options);
};
const isSignal = (value) => {
  return (
    value &&
    typeof value === "object" &&
    "value" in value &&
    typeof value.peek === "function" &&
    typeof value.subscribe === "function"
  );
};

const createActionProxyFromSignal = (
  action,
  paramsSignal,
  { reloadOnChange = true, onChange } = {},
) => {
  const actionTemplate = action.isTemplate ? action : action.template;

  const getActionForParams = () => {
    const params = paramsSignal.value;
    if (!params) {
      return null;
    }
    return actionTemplate.instantiate(params);
  };
  const proxyMethod = (method) => {
    return (...args) => {
      const actionForParams = getActionForParams();
      if (!actionForParams) {
        return undefined;
      }
      return actionForParams[method](...args);
    };
  };

  const actionProxy = {
    isProxy: true,
    name: `Proxy on ${actionTemplate.name}`,
    params: actionTemplate.initialParams,
    loadRequested: actionTemplate.initialLoadRequested,
    loadingState: actionTemplate.initialLoadingState,
    error: actionTemplate.initialError,
    data: actionTemplate.initialData,
    preload: proxyMethod("preload"),
    load: proxyMethod("load"),
    reload: proxyMethod("reload"),
    unload: proxyMethod("unload"),
    toString: () => `Proxy on ${actionTemplate.name}`,
  };

  const proxySignal = (
    signalPropertyName,
    propertyName,
    initialValuePrivatePropertyName,
  ) => {
    const signalProxy = computed(() => {
      const actionForParams = getActionForParams();
      if (!actionForParams) {
        if (!propertyName) {
          return undefined;
        }
        const initialValue = actionTemplate[initialValuePrivatePropertyName];
        actionProxy[propertyName] = initialValue;
        return initialValue;
      }
      const actionForParamsPrivateProperties =
        getActionPrivateProperties(actionForParams);
      const actionForParamsSignal =
        actionForParamsPrivateProperties[signalPropertyName];
      const value = actionForParamsSignal.value;
      if (propertyName) {
        actionProxy[propertyName] = value;
      }
      return value;
    });
    return signalProxy;
  };
  let paramsPrevious = paramsSignal.peek();
  let isFirstEffect = true;
  effect(() => {
    const params = paramsSignal.value;
    actionProxy.params = params;
    if (isFirstEffect) {
      isFirstEffect = false;
    } else {
      if (reloadOnChange) {
        actionProxy.reload();
      }
      if (onChange) {
        onChange(params, paramsPrevious);
      }
    }
    paramsPrevious = params;
  });
  effect(() => {
    const actionForParams = getActionForParams();
    actionProxy.name = actionForParams
      ? `[[Proxy]] ${actionForParams.name}`
      : `[[Proxy]] ${actionTemplate.name}`;
  });

  const proxyPrivateProperties = {
    initialLoadRequested: actionProxy.loadRequested,
    initialLoadingState: actionProxy.loadingState,
    initialParams: actionProxy.params,
    initialError: actionProxy.error,
    initialData: actionProxy.data,

    paramsSignal,
    loadRequestedSignal: proxySignal(
      "loadRequestedSignal",
      "loadRequested",
      "initialLoadRequested",
    ),
    loadingStateSignal: proxySignal(
      "loadingStateSignal",
      "loadingState",
      "initialLoadingState",
    ),
    errorSignal: proxySignal("errorSignal", "error", "initialError"),
    dataSignal: proxySignal("dataSignal", "data", "initialData"),
    computedDataSignal: proxySignal("computedDataSignal"),

    performLoad: (...args) => {
      const actionForParams = getActionForParams();
      if (!actionForParams) {
        throw new Error(
          `Cannot perform load on action proxy "${actionProxy.name}" because params are not set.`,
        );
      }
      const actionForParamsPrivateProperties =
        getActionPrivateProperties(actionForParams);
      return actionForParamsPrivateProperties.performLoad(...args);
    },
    performUnload: (...args) => {
      const actionForParams = getActionForParams();
      if (!actionForParams) {
        throw new Error(
          `Cannot perform unload on action proxy "${actionProxy.name}" because params are not set.`,
        );
      }
      const actionForParamsPrivateProperties =
        getActionPrivateProperties(actionForParams);
      return actionForParamsPrivateProperties.performUnload(...args);
    },
    ui: actionTemplate.ui,
  };
  actionPrivatePropertiesWeakMap.set(actionProxy, proxyPrivateProperties);

  return actionProxy;
};

export const useActionStatus = (action) => {
  if (action.isTemplate) {
    throw new Error(
      `useActionStatus() cannot be used on an action template, only on an action.`,
    );
  }

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
    active: true,
    params,
    idle,
    error,
    aborted,
    pending,
    preloaded,
    data,
  };
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
