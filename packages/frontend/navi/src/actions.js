import { batch, effect, signal } from "@preact/signals";
import { compareTwoJsValues } from "./compare_two_js_values.js";

let debug = true;

export const IDLE = { id: "idle" };
export const ACTIVATING = { id: "activating" };
export const ABORTED = { id: "aborted" };
export const FAILED = { id: "failed" };
export const ACTIVATED = { id: "activated" };

const requestActionsUpdates = ({ toDeactivateSet, toActivateSet }) => {
  // intermediate representing the fact we'll use navigation.navigate to call update action later on
  return updateActions({
    toActivateSet,
    toDeactivateSet,
  });
};
export const reloadActions = async (actionSet, { reason } = {}) => {
  requestActionsUpdates({
    toDeactivateSet: actionSet,
    toActivateSet: actionSet,
    reason,
    isReload: true,
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
      const alreadyActivatingSet = new Set();
      const alreadyActivatedSet = new Set();

      for (const [id, weakRef] of idToActionMap) {
        const action = weakRef.deref();
        if (action) {
          if (action.activationState === ACTIVATING) {
            alreadyActivatingSet.add(action);
          } else if (action.activationState === ACTIVATED) {
            alreadyActivatedSet.add(action);
          }
          throw new Error(
            `An action in the activation registry should be ACTIVATING or ACTIVATED, but got "${action.activationState.id}" for action "${action.name}"`,
          );
        } else {
          idToActionMap.delete(id);
        }
      }
      return {
        alreadyActivatingSet,
        alreadyActivatedSet,
      };
    },

    clear() {
      idToActionMap.clear();
    },
  };
})();

export const updateActions = ({
  signal,
  isReload,
  isReplace,
  reason,
  toActivateSet,
  toDeactivateSet,
} = {}) => {
  if (!signal) {
    const abortController = new AbortController();
    signal = abortController.signal;
  }

  const { alreadyActivatingSet, alreadyActivatedSet } =
    activationRegistry.getInfo();
  const thenableArray = [];

  if (debug) {
    console.group(`updateActions()`);
    console.debug(
      `
- to activate: ${toActivateSet.size === 0 ? "none" : Array.from(toActivateSet).join(", ")}
- to deactivate: ${toDeactivateSet.size === 0 ? "none" : Array.from(toDeactivateSet).join(", ")}
- already activating: ${alreadyActivatingSet.size === 0 ? "none" : Array.from(alreadyActivatingSet).join(", ")}
- already activated: ${alreadyActivatedSet.size === 0 ? "none" : Array.from(alreadyActivatedSet).join(", ")}
- meta: { isReload: ${isReload}, isReplace ${isReplace} }`,
    );
  }

  for (const actionToDeactivate of toDeactivateSet) {
    const actionToDeactivatePrivateProperties =
      getActionPrivateProperties(actionToDeactivate);
    actionToDeactivatePrivateProperties.deactivate(reason);
    activationRegistry.delete(actionToDeactivate);
    alreadyActivatingSet.delete(actionToDeactivate);
    alreadyActivatedSet.delete(actionToDeactivate);
  }

  for (const actionActivating of alreadyActivatingSet) {
    const actionPromise = actionPromiseMap.get(actionActivating);
    thenableArray.push(actionPromise);
  }

  for (const actionToActivate of toActivateSet) {
    if (
      alreadyActivatingSet.has(actionToActivate) ||
      alreadyActivatedSet.has(actionToActivate)
    ) {
      continue;
    }
    const actionToActivatePrivateProperties =
      getActionPrivateProperties(actionToActivate);
    activationRegistry.add(actionToActivate);
    const activatePromise = actionToActivatePrivateProperties.activate();
    if (
      // sync actions are already done, no need to wait for activate promise
      actionToActivate.activationState === ACTIVATED
    ) {
      activationRegistry.delete(actionToActivate);
    } else {
      actionPromiseMap.set(actionToActivate, activatePromise);
      thenableArray.push(activatePromise);
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
  } = {},
) => {
  let activationState = IDLE;
  const activationStateSignal = signal(activationState);
  let error;
  const errorSignal = signal(null);
  let data = initialData;
  const dataSignal = signal(initialData);

  let params = initialParams;
  const paramsSignal = signal(initialParams);
  const parametrizedActions = new Map();
  const parametrizedActionsWeakRefs = new Set();
  const withParams = (newParams, options = {}) => {
    const combinedParams =
      initialParams === initialParamsDefault
        ? newParams
        : { ...initialParams, ...newParams };
    for (const weakRef of parametrizedActionsWeakRefs) {
      if (!weakRef.deref()) {
        parametrizedActionsWeakRefs.delete(weakRef);
      }
    }
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
      initialParams: combinedParams,
      sideEffect,
      ...options,
    });
    const weakRef = new WeakRef(parametrizedAction);
    parametrizedActions.set(combinedParams, weakRef);
    parametrizedActionsWeakRefs.add(weakRef);
    return parametrizedAction;
  };
  const start = () => {
    return requestActionsUpdates({
      toActivateSet: new Set([action]),
    });
  };
  const stop = () => {
    return requestActionsUpdates({
      toDeactivateSet: new Set([action]),
    });
  };

  const action = {
    name,
    params,
    activationState,
    error,
    data,
    start,
    stop,
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
      activationState = activationStateSignal.value;
      actionRef.activationState = activationState;
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
    let sideEffectCleanup;
    const activate = ({ signal }) => {
      const abortController = new AbortController();
      const abortSignal = abortController.signal;
      const abort = (reason) => {
        if (debug) {
          console.log(`"${action}": abort activation.`);
        }
        activationStateSignal.value = ABORTED;
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
        activationStateSignal.value = ACTIVATING;
      });

      const returnValue = sideEffect();
      if (typeof returnValue === "function") {
        sideEffectCleanup = returnValue;
      }

      let loadResult;
      const onLoadEnd = () => {
        dataSignal.value = loadResult;
        activationStateSignal.value = ACTIVATED;
        actionAbortMap.delete(action);
        actionPromiseMap.delete(action);
      };
      const onLoadError = (e) => {
        signal.removeEventListener("abort", onabort);
        actionAbortMap.delete(action);
        actionPromiseMap.delete(action);
        if (abortSignal.aborted && e === abortSignal.reason) {
          activationStateSignal.value = ABORTED;
          return;
        }
        batch(() => {
          errorSignal.value = e;
          activationStateSignal.value = FAILED;
        });
      };

      try {
        loadResult = load({ signal: abortSignal });
        if (loadResult && typeof loadResult.then === "function") {
          return loadResult.then(
            (value) => {
              loadResult = value;
              onLoadEnd();
            },
            (e) => {
              onLoadError(e);
            },
          );
        }
        onLoadEnd();
      } catch (e) {
        onLoadError(e);
      }
      return undefined;
    };
    const deactivate = (reason) => {
      const abort = actionAbortMap.get(action);
      if (abort) {
        if (debug) {
          console.log(`"${action}": aborting (reason: ${reason})`);
        }
        abort(reason);
      } else if (debug) {
        console.log(`"${action}": deactivating route (reason: ${reason})`);
      }
      if (sideEffectCleanup) {
        sideEffectCleanup(reason);
        sideEffectCleanup = undefined;
      }
      actionPromiseMap.delete(action);
      batch(() => {
        errorSignal.value = null;
        activationStateSignal.value = IDLE;
      });
    };
    const ui = {
      renderLoaded: null,
      renderLoadedAsync,
    };
    const loadUI = (...args) => {
      const renderLoadedAsync = ui.renderLoadedAsync;
      if (renderLoadedAsync) {
        return renderLoadedAsync(...args).then((renderLoaded) => {
          ui.renderLoaded = () => renderLoaded;
        });
      }
      return null;
    };
    const load = ({ signal }) => {
      let result;
      const thenableArray = [];
      const callbackResult = callback({ signal, ...params });
      if (callbackResult && typeof callbackResult.then === "function") {
        thenableArray.push(callbackResult);
        callbackResult.then((value) => {
          result = value;
        });
      } else {
        result = callbackResult;
      }
      const uiLoadResult = loadUI({ signal, ...params });
      if (uiLoadResult && typeof uiLoadResult.then === "function") {
        thenableArray.push(uiLoadResult);
      }
      if (thenableArray.length === 0) {
        return result;
      }
      return Promise.all(thenableArray).then(() => result);
    };
    const actionPrivateProperties = {
      initialParams,
      initialData,
      paramsSignal,

      dataSignal,
      errorSignal,
      activationStateSignal,

      activate,
      deactivate,
      ui,
    };
    actionPrivatePropertiesWeakMap.set(action, actionPrivateProperties);
  }

  return action;
};

const generateParamsSuffix = (params) => {
  const keys = Object.keys(params);
  if (keys.length === 0) {
    return "";
  }
  if (keys.length === 1) {
    const value = params[keys[0]];
    return `: ${value}`;
  }
  return `(${JSON.stringify(params)})`;
};

export const useActionStatus = (action) => {
  const { paramsSignal, errorSignal, activationStateSignal, dataSignal } =
    getActionPrivateProperties(action);

  const params = paramsSignal.value;
  const error = errorSignal.value;
  const activationState = activationStateSignal.value;
  const pending = activationState === ACTIVATING;
  const aborted = activationState === ABORTED;
  const data = dataSignal.value;
  return {
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
