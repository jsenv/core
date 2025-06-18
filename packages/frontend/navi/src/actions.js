import { batch, computed, effect, signal } from "@preact/signals";
import { compareTwoJsValues } from "./compare_two_js_values.js";

let debug = true;

export const IDLE = { id: "idle" };
export const LOADING = { id: "loading" };
export const ABORTED = { id: "aborted" };
export const FAILED = { id: "failed" };
export const LOADED = { id: "loaded" };

// intermediate function representing the fact we'll use navigation.navigate update action and get a signal
export const requestActionsUpdates = ({
  loadSet,
  unloadSet,
  isReload,
  reason,
}) => {
  const signal = new AbortController().signal;
  return updateActions({
    signal,
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
// export const reloadPendingActions
// export const abortPendingActions

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
  const toLoadSet = new Set();
  const staysLoadingSet = new Set();
  const staysLoadedSet = new Set();

  for (const actionToLoad of loadSet) {
    if (
      actionToLoad.loadingState === LOADING ||
      actionToLoad.loadingState === LOADED
    ) {
      // by default when an action is already activating/activated
      // requesting an activation does nothing.
      // this way
      // - clicking a link already active in the UI does nothing
      // - requesting to load an action already pending does not abort + reload it
      // in order to re-activate the same action
      // code has to
      // - first deactivate it
      // - or request deactivationg + activation at the same time
      // - or use isReload: true when requesting the activation of this action
      if (isReload || toUnloadSet.has(actionToLoad)) {
        toUnloadSet.add(actionToLoad);
        toLoadSet.add(actionToLoad);
      } else {
      }
    } else {
      toLoadSet.add(actionToLoad);
    }
  }
  for (const actionToUnload of unloadSet) {
    if (actionToUnload.loadingState !== IDLE) {
      toUnloadSet.add(actionToUnload);
    }
  }
  const thenableArray = [];
  for (const actionLoading of loadingSet) {
    if (toUnloadSet.has(actionLoading)) {
      // will be de-activated (aborted), we don't want to wait
    } else if (toLoadSet.has(actionLoading)) {
      // will be activated, we'll wait for the new activate promise
    } else {
      // an action that was activating and not affected by this update
      // add it to the list of pending things
      const actionPromise = actionPromiseMap.get(actionLoading);
      thenableArray.push(actionPromise);
      staysLoadingSet.add(actionLoading);
    }
  }
  for (const actionLoaded of loadedSet) {
    if (toUnloadSet.has(actionLoaded)) {
      // will be de-activated
    } else {
      staysLoadedSet.add(actionLoaded);
    }
  }

  if (debug) {
    const lines = [
      ...(toUnloadSet.size
        ? [`- to unload: ${Array.from(toUnloadSet).join(", ")}`]
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

  for (const actionToUnload of toUnloadSet) {
    const actionToUnloadPrivateProperties =
      getActionPrivateProperties(actionToUnload);
    actionToUnloadPrivateProperties.performUnload(reason);
    activationRegistry.delete(actionToUnload);
  }
  for (const actionToLoad of toLoadSet) {
    const actionToLoadPrivateProperties =
      getActionPrivateProperties(actionToLoad);
    const loadPromise = actionToLoadPrivateProperties.performLoad({
      signal,
      reason,
    });
    activationRegistry.add(actionToLoad);
    if (
      // sync actions are already done, no need to wait for activate promise
      actionToLoad.loadingState === LOADED
    ) {
    } else {
      actionPromiseMap.set(actionToLoad, loadPromise);
      thenableArray.push(loadPromise);
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
const getActionPrivateProperties = (action) => {
  const actionPrivateProperties = actionPrivatePropertiesWeakMap.get(action);
  if (!actionPrivateProperties) {
    throw new Error(`Cannot find action private properties for "${action}"`);
  }
  return actionPrivateProperties;
};
export const createAction = (
  callback,
  {
    name = callback.name || "anonymous",
    params: initialParams = initialParamsDefault,
    data: initialData,
    renderLoadedAsync,
    sideEffect = () => {},
    isTemplate = false,
    keepOldData = false,
  },
) => {
  let loadingState = IDLE;
  const loadingStateSignal = signal(loadingState);
  const activeSignal = computed(() => {
    const loadingState = loadingStateSignal.value;
    return loadingState !== IDLE;
  });
  let error;
  const errorSignal = signal(null);
  let data = initialData;
  const dataSignal = signal(initialData);

  let params = initialParams;
  const paramsSignal = signal(initialParams);
  const parametrizedActions = new Map();
  const parametrizedActionsWeakRefs = new Set();
  const getAliveParametrizedActionSet = () => {
    const aliveParametrizedActionSet = new Set();
    for (const weakRef of parametrizedActionsWeakRefs) {
      const parametrizedAction = weakRef.deref();
      if (parametrizedAction) {
        aliveParametrizedActionSet.add(parametrizedAction);
      } else {
        parametrizedActionsWeakRefs.delete(weakRef);
      }
    }
    return aliveParametrizedActionSet;
  };

  const withParams = (newParams, options = {}) => {
    const combinedParams =
      initialParams === initialParamsDefault
        ? newParams
        : typeof initialParams === "object" && initialParams !== null
          ? { ...initialParams, ...newParams }
          : newParams;
    for (const [existingParams, weakRef] of parametrizedActions) {
      const existingAction = weakRef.deref();
      if (
        existingAction &&
        compareTwoJsValues(existingParams, combinedParams)
      ) {
        return existingAction;
      }
      if (!existingAction) {
        parametrizedActions.delete(existingParams);
      }
    }

    const parametrizedAction = createAction(callback, {
      name: `${action.name}${generateParamsSuffix(combinedParams)}`,
      params: combinedParams,
      sideEffect, // call the parent side effect
      parent: action,
      ...options,
    });
    parametrizedAction.load = (options) => {
      const aliveParametrizedActionSet = getAliveParametrizedActionSet();
      return requestActionsUpdates({
        unloadSet: aliveParametrizedActionSet,
        loadSet: new Set([parametrizedAction]),
        ...options,
      });
    };

    const parametrizedActionPrivateProperties =
      getActionPrivateProperties(parametrizedAction);
    // TODO: this effect should be weak
    effect(() => {
      const parametrizedActionLoadingState =
        parametrizedActionPrivateProperties.loadingStateSignal.value;
      loadingStateSignal.value = parametrizedActionLoadingState;

      const parametrizedActionParams =
        parametrizedActionPrivateProperties.paramsSignal.value;
      paramsSignal.value = parametrizedActionParams;

      const parametrizedActionError =
        parametrizedActionPrivateProperties.errorSignal.value;
      errorSignal.value = parametrizedActionError;

      const parametrizedActionData =
        parametrizedActionPrivateProperties.dataSignal.value;
      dataSignal.value = parametrizedActionData;
    });

    const weakRef = new WeakRef(parametrizedAction);
    parametrizedActions.set(combinedParams, weakRef);
    parametrizedActionsWeakRefs.add(weakRef);
    return parametrizedAction;
  };
  const load = isTemplate
    ? () => {
        throw new Error(
          `Cannot load action template "${name}", use withParams() to set parameters first.`,
        );
      }
    : (options) =>
        requestActionsUpdates({
          loadSet: new Set([action]),
          ...options,
        });

  const unload = isTemplate
    ? () => {
        throw new Error(`Cannot unload action template "${name}".`);
      }
    : () =>
        requestActionsUpdates({
          unloadSet: new Set([action]),
        });

  const action = {
    name,
    params,
    loadingState,
    error,
    data,
    load,
    unload,
    withParams,
    toString: () => name,
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
      params = paramsSignal.value;
      actionRef.params = params;
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
    const performLoad = ({ signal, reason }) => {
      const abortController = new AbortController();
      const abortSignal = abortController.signal;
      const abort = (reason) => {
        if (debug) {
          console.log(`"${action}": abort activation.`);
        }
        loadingStateSignal.value = ABORTED;
        abortController.abort(reason);
        actionAbortMap.delete(action);
      };
      const onabort = () => {
        abort(signal.reason);
      };
      signal.addEventListener("abort", onabort);
      actionAbortMap.set(action, abort);

      batch(() => {
        errorSignal.value = null;
        loadingStateSignal.value = LOADING;
      });

      const returnValue = sideEffect(params);
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
        signal.removeEventListener("abort", onabort);
        actionAbortMap.delete(action);
        actionPromiseMap.delete(action);
        if (abortSignal.aborted && e === abortSignal.reason) {
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
        const callbackResult = callback(params, { signal, reason });
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
          const renderLoadedPromise = renderLoadedAsync(params, {
            signal,
            reason,
          }).then((renderLoaded) => {
            ui.renderLoaded = () => renderLoaded;
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
        console.log(`"${action}": unload route (reason: ${reason})`);
      }
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
        loadingStateSignal.value = IDLE;
      });
    };
    const actionPrivateProperties = {
      initialParams,
      initialData,

      loadingStateSignal,
      activeSignal,
      paramsSignal,
      dataSignal,
      errorSignal,

      performLoad,
      performUnload,
      ui,
    };
    actionPrivatePropertiesWeakMap.set(action, actionPrivateProperties);
  }

  return action;
};
export const createActionTemplate = (callback, options) => {
  return createAction(callback, { isTemplate: true, ...options });
};

const generateParamsSuffix = (params) => {
  if (params === null || typeof params !== "object") {
    return `(${params})`;
  }
  const keys = Object.keys(params);
  if (keys.length === 0) {
    return "";
  }
  return `(${JSON.stringify(params)})`;
};

export const useActionStatus = (action) => {
  const {
    loadingStateSignal,
    activeSignal,
    paramsSignal,
    errorSignal,
    dataSignal,
  } = getActionPrivateProperties(action);

  const active = activeSignal.value;
  const params = paramsSignal.value;
  const error = errorSignal.value;
  const loadingState = loadingStateSignal.value;
  const pending = loadingState === LOADING;
  const aborted = loadingState === ABORTED;
  const data = dataSignal.value;
  return {
    active,
    params,
    error,
    aborted,
    pending,
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
