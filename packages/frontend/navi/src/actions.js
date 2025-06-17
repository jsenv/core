import { batch, effect, signal } from "@preact/signals";
import { compareTwoJsValues } from "./compare_two_js_values.js";

let debug = true;

export const IDLE = { id: "idle" };
export const ACTIVATING = { id: "activating" };
export const ABORTED = { id: "aborted" };
export const FAILED = { id: "failed" };
export const ACTIVATED = { id: "activated" };

const matchingActionRegistry = (() => {
  const actionToIdMap = new WeakMap();
  const idToActionMap = new Map();
  let nextId = 1;

  const getMatchingSet = () => {
    const matchingSet = new Set();
    for (const [id, weakRef] of idToActionMap) {
      const action = weakRef.deref();
      if (action) {
        matchingSet.add(action);
      } else {
        idToActionMap.delete(id);
      }
    }
    return matchingSet;
  };

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

    getMatchingSet,

    get size() {
      return getMatchingSet().size;
    },

    clear() {
      idToActionMap.clear();
    },

    // Méthodes pour compatibilité avec l'API Set
    [Symbol.iterator]() {
      return getMatchingSet()[Symbol.iterator]();
    },
  };
})();

const actionAbortMap = new Map();
const actionPromiseMap = new Map();
const actionWeakRefSet = new Set();
const getAliveActionSet = () => {
  const aliveSet = new Set();
  for (const weakRef of actionWeakRefSet) {
    const action = weakRef.deref();
    if (action) {
      aliveSet.add(action);
    } else {
      actionWeakRefSet.delete(weakRef);
    }
  }
  return aliveSet;
};

let idleCallbackId;
const onActionConnected = () => {
  cancelIdleCallback(idleCallbackId);
  idleCallbackId = requestIdleCallback(() => {
    updateActions();
  });
};

export const updateActions = async ({
  signal,
  isReload,
  isReplace,
  reason,
  toReloadSet,
} = {}) => {
  cancelIdleCallback(idleCallbackId);

  if (!signal) {
    const abortController = new AbortController();
    signal = abortController.signal;
  }

  const toDeactivateSet = new Set();
  const toActivateMap = new Map();
  const candidateSet = toReloadSet || getAliveActionSet();
  const promises = [];
  const alreadyActivatingSet = new Set();
  const alreadyActivatedSet = new Set();
  const matchingActionSet = matchingActionRegistry.getMatchingSet();

  if (debug) {
    const documentUrl = window.location.href;
    const documentState = navigation.currentEntry.getState();

    console.group(`updateActions() on ${candidateSet.size} actions`);
    console.debug(
      `situation at start:
- document url: ${documentUrl.slice(window.origin.length)}
- document state: ${documentState}
- matching actions: ${matchingActionSet.size === 0 ? "none" : Array.from(matchingActionSet).join(", ")}
- meta: isReload: ${isReload}, isReplace ${isReplace}`,
    );
  }

  for (const actionCandidate of candidateSet) {
    const matchParams = actionCandidate.getMatchParams();
    if (!matchParams) {
      continue;
    }
    const enterParams = {
      signal,
      matchParams,
    };
    const startsMatching = !matchingActionSet.has(actionCandidate);
    if (startsMatching) {
      toActivateMap.set(actionCandidate, enterParams);
    } else if (actionCandidate.shouldReload({ matchParams })) {
      toDeactivateSet.add(actionCandidate);
      toActivateMap.set(actionCandidate, enterParams);
    } else {
      const hasError = actionCandidate.error;
      const isAborted = actionCandidate.activationState === ABORTED;
      if (isReload) {
        toActivateMap.set(actionCandidate, enterParams);
      } else if (hasError) {
        toActivateMap.set(actionCandidate, enterParams);
      } else if (isAborted) {
        toActivateMap.set(actionCandidate, enterParams);
      } else {
        const actionPromise = actionPromiseMap.get(actionCandidate);
        if (actionPromise) {
          alreadyActivatingSet.add(actionCandidate);
          promises.push(actionPromise);
        } else {
          alreadyActivatedSet.add(actionCandidate);
        }
      }
    }
  }
  for (const matchingAction of matchingActionSet) {
    if (
      alreadyActivatingSet.has(matchingAction) ||
      alreadyActivatedSet.has(matchingAction) ||
      toActivateMap.has(matchingAction)
    ) {
      continue;
    }
    toDeactivateSet.add(matchingAction);
  }

  if (
    toActivateMap.size === 0 &&
    toDeactivateSet.size === 0 &&
    alreadyActivatingSet.size === 0
  ) {
    if (debug) {
      console.debug("no effect on actions, early return");
      console.groupEnd();
    }
    return;
  }

  if (debug) {
    console.debug(`situation before updating actions:
- to de-activate: ${toDeactivateSet.size === 0 ? "none" : Array.from(toDeactivateSet).join(", ")}
- to activate: ${toActivateMap.size === 0 ? "none" : Array.from(toActivateMap.keys()).join(", ")}
- already activating: ${alreadyActivatingSet.size === 0 ? "none" : Array.from(alreadyActivatingSet).join(", ")}
- already activated: ${alreadyActivatedSet.size === 0 ? "none" : Array.from(alreadyActivatedSet).join(", ")}`);
  }
  for (const actionToDeactivate of toDeactivateSet) {
    deactivate(actionToDeactivate, reason);
  }

  for (const [action, actionParams] of toActivateMap) {
    const actionPromise = activate(action, actionParams);
    if (
      // sync actions are already done, no need to wait for activate promise
      action.activationStateSignal.peek() === ACTIVATING
    ) {
      actionPromiseMap.set(action, actionPromise);
      promises.push(actionPromise);
    }
  }
  await Promise.all(promises);

  if (debug) {
    console.groupEnd();
  }
};
export const reloadActions = async ({ reason } = {}) => {
  const toReloadSet = matchingActionRegistry.getMatchingSet();

  await updateActions({
    isReload: true,
    toReloadSet,
    reason,
  });
};
export const updateMatchingActionParams = async (action, params) => {
  action.paramsSignal.value = params;
  action.activationEffect(params);
};

const activate = async (action, { signal, matchParams }) => {
  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  const abort = (reason) => {
    if (debug) {
      console.log(`"${action}": abort activation.`);
    }
    action.activationStateSignal.value = ABORTED;
    abortController.abort(reason);
    actionAbortMap.delete(action);
  };
  const onabort = () => {
    abort(signal.reason);
  };
  signal.addEventListener("abort", onabort);
  actionAbortMap.set(action, abort);

  batch(() => {
    action.isMatchingSignal.value = true;
    action.paramsSignal.value = matchParams;
    action.errorSignal.value = null;
    action.activationStateSignal.value = ACTIVATING;
  });
  action.activationEffect(matchParams);
  matchingActionRegistry.add(action);

  let loadResult;
  const onLoadEnd = () => {
    action.dataSignal.value = loadResult;
    action.activationStateSignal.value = ACTIVATED;
    actionAbortMap.delete(action);
    actionPromiseMap.delete(action);
  };

  try {
    loadResult = action.load({ signal: abortSignal });
    if (loadResult && typeof loadResult.then === "function") {
      loadResult = await loadResult;
      onLoadEnd();
    } else {
      onLoadEnd();
    }
  } catch (e) {
    signal.removeEventListener("abort", onabort);
    actionAbortMap.delete(action);
    actionPromiseMap.delete(action);
    if (abortSignal.aborted && e === abortSignal.reason) {
      action.activationStateSignal.value = ABORTED;
      return;
    }
    batch(() => {
      action.reportError(e);
      action.activationStateSignal.value = FAILED;
    });
  }
};

const deactivate = (action, reason) => {
  const abort = actionAbortMap.get(action);
  if (abort) {
    if (debug) {
      console.log(`"${action}": aborting (reason: ${reason})`);
    }
    abort(reason);
  } else if (debug) {
    console.log(`"${action}": deactivating route (reason: ${reason})`);
  }
  action.deactivationEffect(reason);
  matchingActionRegistry.delete(action);
  actionPromiseMap.delete(action);
  batch(() => {
    action.isMatchingSignal.value = false;
    action.paramsSignal.value = action.initialParams;
    action.errorSignal.value = null;
    action.activationStateSignal.value = IDLE;
  });
};

const registeredActionWeakSet = new WeakSet();
export const registerAction = (...args) => {
  const action = createAction(...args);
  const weakRef = new WeakRef(action);
  actionWeakRefSet.add(weakRef);

  registeredActionWeakSet.set(action, true);
  return action;
};

const isRegistered = (action) => {
  return registeredActionWeakSet.has(action);
};

const initialParamsDefault = {};
export const createAction = (
  callback,
  {
    name = callback.name || "anonymous",
    initialParams = initialParamsDefault,
    initialData,
    renderLoadedAsync,
  } = {},
) => {
  const isMatchingSignal = signal(false);
  let activationState = IDLE;
  const activationStateSignal = signal(activationState);
  let error;
  const errorSignal = signal(null);
  const reportError = (e) => {
    errorSignal.value = e;
  };
  let data = initialData;
  const dataSignal = signal(initialData);

  let params = initialParams;
  const paramsSignal = signal(initialParams);

  const match = () => false;

  const activationEffect = () => {};
  const deactivationEffect = () => {};
  const shouldReload = ({ matchParams }) => {
    if (compareTwoJsValues(matchParams, params)) {
      return false;
    }
    return true;
  };

  const start = async (params = initialParams) => {
    // TOFIX: quand l'action est paramétrée c'est le start du parent qui se délenche
    // et qui fail parce qu'il toruve pas ce qu'il faut dans le local storage
    const matchPrevious = action.match;
    const stopPrevious = action.stop;
    const startPrevious = action.start;

    action.start = (...args) => {
      // when starting again, we first restore stop/match so that updateActions would stop this one
      // then we actually start (which would hook into .match and .stop then call updateActions)
      // which in turn will first
      action.start = startPrevious;
      action.stop = stopPrevious;
      action.match = matchPrevious;
      return startPrevious(...args);
    };
    action.match = () => params;
    action.stop = async () => {
      action.stop = stopPrevious;
      action.match = matchPrevious;
      await updateActions();
    };
    await updateActions();
  };
  const stop = () => {
    // nothing to do, only match can change that right?
  };

  const parametrizedActions = new Map();
  const parametrizedActionsWeakRefs = new Set();
  const withParams = (newParams, options = {}) => {
    const combinedParams = { ...initialParams, ...newParams };
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
        // Nettoyer les références mortes
        parametrizedActions.delete(existingParams);
      }
    }

    const parametrizedAction = createAction(callback, {
      name: `${action.name}${generateParamsSuffix(combinedParams)}`,
      initialParams: combinedParams,
      ...options,
    });
    const weakRef = new WeakRef(parametrizedAction);
    parametrizedActions.set(combinedParams, weakRef);
    parametrizedActionsWeakRefs.add(weakRef);
    if (isRegistered(action)) {
      registerAction(parametrizedAction);
    }
    return parametrizedAction;
  };

  const action = {
    isMatchingSignal,
    initialParams,
    initialData,
    params,
    paramsSignal,
    match,
    getMatchParams: () => {
      const matchResult = action.match();
      if (!matchResult) {
        return null;
      }
      return matchResult;
    },
    load: ({ signal }) => {
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
      if (action.ui.load) {
        const uiLoadResult = action.ui.load({ signal, ...params });
        if (uiLoadResult && typeof uiLoadResult.then === "function") {
          thenableArray.push(uiLoadResult);
        }
      }
      if (thenableArray.length === 0) {
        return result;
      }
      return Promise.all(thenableArray).then(() => result);
    },
    ui: {
      renderLoaded: null,
      renderLoadedAsync,
      load: (...args) => {
        const renderLoadedAsync = action.ui.renderLoadedAsync;
        if (renderLoadedAsync) {
          return renderLoadedAsync(...args).then((renderLoaded) => {
            action.ui.renderLoaded = () => renderLoaded;
          });
        }
        return null;
      },
    },

    activationState,
    activationStateSignal,
    error,
    errorSignal,
    reportError,
    data,
    dataSignal,

    activationEffect,
    deactivationEffect,
    shouldReload,
    toString: () => name,
    name,
    start,
    stop,
    withParams,
  };
  Object.preventExtensions(action);

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
  const isMatching = action.isMatchingSignal.value;
  const params = action.paramsSignal.value;
  const error = action.errorSignal.value;
  const activationState = action.activationState.value;
  const pending = activationState === ACTIVATING;
  const aborted = activationState === ABORTED;
  const data = action.dataSignal.value;
  return {
    matching: isMatching,
    params,
    error,
    aborted,
    pending,
    data,
  };
};

export const connectActionWithLocalStorageBoolean = (
  action,
  key,
  { defaultValue = false } = {},
) => {
  action.match = () => {
    const value = localStorage.getItem(key);
    if (value === null) {
      return defaultValue;
    }
    return value === "true";
  };

  const activationEffect = () => {
    localStorage.setItem(key, "true");
  };
  const deactivationEffect = () => {
    if (defaultValue === true) {
      localStorage.setItem(key, "false");
    } else {
      localStorage.removeItem(key);
    }
  };
  action.activationEffect = activationEffect;
  action.deactivationEffect = deactivationEffect;
  onActionConnected();
};
export const connectActionWithLocalStorageString = (
  action,
  key,
  actionParamName = key,
  { defaultValue = "" } = {},
) => {
  action.match = () => {
    const value = localStorage.getItem(key);
    if (value === null) {
      return defaultValue ? { [actionParamName]: defaultValue } : null;
    }
    return { [actionParamName]: value };
  };

  const activationEffect = (params) => {
    const valueToStore = params[actionParamName];
    localStorage.setItem(key, valueToStore);
  };

  const deactivationEffect = () => {
    localStorage.removeItem(key);
  };

  action.activationEffect = activationEffect;
  action.deactivationEffect = deactivationEffect;
  onActionConnected();
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
