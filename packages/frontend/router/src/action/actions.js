import { batch, effect, signal } from "@preact/signals";
import { compareTwoJsValues } from "../compare_two_js_values.js";

let debug = true;

export const IDLE = { id: "idle" };
export const ACTIVATING = { id: "activating" };
export const ABORTED = { id: "aborted" };
export const FAILED = { id: "failed" };
export const ACTIVATED = { id: "activated" };

const actionAbortMap = new Map();
const actionPromiseMap = new Map();
const actionWeakRefSet = new Set();
const matchingActionSet = new Set();
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

export const updateActions = async ({
  signal,
  isReload,
  isReplace,
  reason,
} = {}) => {
  if (!signal) {
    const abortController = new AbortController();
    signal = abortController.signal;
  }

  const toDeactivateSet = new Set();
  const toActivateMap = new Map();
  const candidateSet = getAliveActionSet();
  const promises = [];
  const alreadyActivatingSet = new Set();
  const alreadyActivatedSet = new Set();

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
    if (startsMatching || actionCandidate.shouldReload({ matchParams })) {
      toActivateMap.set(actionCandidate, enterParams);
    } else {
      const hasError = actionCandidate.errorSignal.peek();
      const isAborted = actionCandidate.stateSignal.peek() === ABORTED;
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
    actionPromiseMap.set(action, actionPromise);
    promises.push(actionPromise);
  }
  await Promise.all(promises);

  if (debug) {
    console.groupEnd();
  }
};

const activate = async (action, { signal, matchParams }) => {
  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  const abort = (reason) => {
    if (debug) {
      console.log(`"${action}": abort activation.`);
    }
    action.stateSignal.value = ABORTED;
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
    action.stateSignal.value = ACTIVATING;
  });
  action.activationEffect(matchParams);
  matchingActionSet.add(action);

  try {
    const loadResult = await action.load({ signal: abortSignal });
    action.dataSignal.value = loadResult;
    action.stateSignal.value = ACTIVATED;
    actionAbortMap.delete(action);
    actionPromiseMap.delete(action);
  } catch (e) {
    signal.removeEventListener("abort", onabort);
    actionAbortMap.delete(action);
    actionPromiseMap.delete(action);
    if (abortSignal.aborted && e === abortSignal.reason) {
      action.stateSignal.value = ABORTED;
      return;
    }
    batch(() => {
      action.reportError(e);
      action.stateSignal.value = FAILED;
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
  matchingActionSet.delete(action);
  actionPromiseMap.delete(action);
  batch(() => {
    action.isMatchingSignal.value = false;
    action.paramsSignal.value = action.initialParams;
    action.errorSignal.value = null;
    action.stateSignal.value = IDLE;
  });
};

export const registerAction = (...args) => {
  const action = createAction(...args);
  const weakRef = new WeakRef(action);
  actionWeakRefSet.add(weakRef);
  return action;
};

const initialParamsDefault = {};
const createAction = (
  callback,
  {
    name = callback.name || "anonymous",
    initialParams = initialParamsDefault,
    initialData,
    parentAction,
    renderLoadedAsync,
  } = {},
) => {
  const isMatchingSignal = signal(false);
  const stateSignal = parentAction ? parentAction.stateSignal : signal(IDLE);
  let error;
  const errorSignal = parentAction ? parentAction.errorSignal : signal(null);
  const reportError = (e) => {
    errorSignal.value = e;
  };
  let data = initialData;
  const dataSignal = parentAction
    ? parentAction.dataSignal
    : signal(initialData);

  let params = initialParams;
  const paramsSignal = signal(initialParams);

  const activationEffect = (...args) => {
    if (parentAction) {
      parentAction.activationEffect(...args);
    }
  };
  const deactivationEffect = (...args) => {
    if (parentAction) {
      parentAction.deactivationEffect(...args);
    }
  };
  const shouldReload = ({ matchParams }) => {
    if (parentAction) {
      return parentAction.shouldReload();
    }
    if (compareTwoJsValues(matchParams, params)) {
      return false;
    }
    return true;
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

  const toString = () => {
    const suffix = generateParamsSuffix(initialParams);
    return `${name}${suffix}`;
  };
  const start = async (options) => {
    action.activationEffect(initialParams);
    await updateActions(options);
  };
  const stop = async (options) => {
    action.deactivationEffect();
    await updateActions(options);
  };

  const parametrizedActions = new Map(); // Changer de Set à Map pour stocker params -> action
  const parametrizedActionsWeakRefs = new Set();
  let matchingParametrizedAction;

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
      name: action.name,
      initialParams: combinedParams,
      parentAction: action,
      ...options,
    });
    const weakRef = new WeakRef(parametrizedAction);
    parametrizedActions.set(combinedParams, weakRef);
    parametrizedActionsWeakRefs.add(weakRef);
    return parametrizedAction;
  };

  const action = {
    isMatchingSignal,
    initialParams,
    initialData,
    params,
    paramsSignal,
    match: () => false,
    getMatchParams: () => {
      matchingParametrizedAction = null;
      const matchResult = action.match();
      if (!matchResult) {
        return null;
      }
      const matchParams = matchResult === true ? {} : matchResult;
      for (const [params, parametrizedActionWeakRef] of parametrizedActions) {
        const parametrizedAction = parametrizedActionWeakRef.deref();
        if (compareTwoJsValues(params, matchParams)) {
          parametrizedAction.isMatchingSignal.value = true;
          parametrizedAction.paramsSignal.value = matchParams;
          matchingParametrizedAction = parametrizedAction;
        } else {
          parametrizedAction.isMatchingSignal.value = false;
          parametrizedAction.paramsSignal.value =
            parametrizedAction.initialParams;
        }
      }
      return matchParams;
    },
    load: async ({ signal }) => {
      const promises = [];
      const loadPromise = callback({ signal, ...params });
      promises.push(loadPromise);
      let result;
      loadPromise.then((value) => {
        result = value;
      });
      if (action.ui.load) {
        const uiLoadPromise = action.ui.load({ signal, ...params });
        promises.push(uiLoadPromise);
      }
      await Promise.all(promises);
      return result;
    },
    ui: {
      renderLoaded: null,
      renderLoadedAsync,
      load: async (...args) => {
        if (matchingParametrizedAction) {
          await matchingParametrizedAction.ui.load(...args);
        }
        const renderLoadedAsync = action.ui.renderLoadedAsync;
        if (renderLoadedAsync) {
          const renderLoaded = await renderLoadedAsync(...args);
          action.ui.renderLoaded = () => renderLoaded;
        }
      },
    },

    stateSignal,
    error,
    errorSignal,
    reportError,
    data,
    dataSignal,

    activationEffect,
    deactivationEffect,
    shouldReload,
    toString,
    get name() {
      return toString();
    },
    start,
    stop,
    withParams,
    parametrizedActions,
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
    error = errorSignal.value;
    actionRef.error = error;
  });
  actionWeakEffect((actionRef) => {
    data = dataSignal.value;
    actionRef.data = data;
  });

  return action;
};

export const useActionStatus = (action) => {
  const isMatching = action.isMatchingSignal.value;
  const params = action.paramsSignal.value;
  const error = action.errorSignal.value;
  const state = action.stateSignal.value;
  const pending = state === ACTIVATING;
  const aborted = state === ABORTED;
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

let idleCallbackId;
const onActionConnected = () => {
  cancelIdleCallback(idleCallbackId);
  idleCallbackId = requestIdleCallback(() => {
    updateActions();
  });
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
  paramName = key,
  { defaultValue = "" } = {},
) => {
  action.match = () => {
    const value = localStorage.getItem(key);
    if (value === null) {
      return defaultValue ? { [paramName]: defaultValue } : null;
    }
    return { [paramName]: value };
  };

  const activationEffect = (params) => {
    const valueToStore = params[paramName];
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
