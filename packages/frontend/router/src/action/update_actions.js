import { batch, effect, signal } from "@preact/signals";

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

// Map pour les actions paramétrées
const parametrizedActionWeakRefSet = new Set();

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
  // Ajouter les actions paramétrées
  for (const weakRef of parametrizedActionWeakRefSet) {
    const action = weakRef.deref();
    if (action) {
      aliveSet.add(action);
    } else {
      parametrizedActionWeakRefSet.delete(weakRef);
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
- document url: ${documentUrl}
- document state: ${documentState}
- matching actions: ${matchingActionSet.size === 0 ? "none" : Array.from(matchingActionSet).join(", ")}
- meta: isReload: ${isReload}, isReplace ${isReplace}`,
    );
  }

  for (const actionCandidate of candidateSet) {
    const matchResult = actionCandidate.match();
    if (!matchResult) {
      continue;
    }
    const targetParams = {
      ...matchResult.named,
      ...matchResult.stars,
    };
    const enterParams = {
      signal,
      matchResult: targetParams,
    };
    const startsMatching = !matchingActionSet.has(actionCandidate);
    if (startsMatching || actionCandidate.shouldReload({ matchResult })) {
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

const activate = async (action, { signal, matchResult }) => {
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
    action.paramsSignal.value = matchResult;
    action.errorSignal.value = null;
    action.stateSignal.value = ACTIVATING;
  });
  action.activationEffect({ matchResult });
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
    parentAction,
  } = {},
) => {
  const isMatchingSignal = parentAction
    ? parentAction.isMatchingSignal
    : signal(false);
  const stateSignal = signal(IDLE);
  let error;
  const errorSignal = parentAction ? parentAction.errorSignal : signal(null);
  const reportError = (e) => {
    errorSignal.value = e;
  };
  const initialData = undefined;
  let data = initialData;
  const dataSignal = parentAction
    ? parentAction.dataSignal
    : signal(initialData);

  let params = initialParams;
  const paramsSignal = parentAction
    ? parentAction.paramsSignal
    : signal(initialParams);

  const match = () => null;
  const activationEffect = () => {};
  const deactivationEffect = () => {};
  const shouldReload = () => false;
  const toString = () => name;
  const start = async (options) => {
    action.activationEffect();
    await updateActions(options);
  };
  const stop = async (options) => {
    action.deactivationEffect();
    await updateActions(options);
  };

  // Implémentation de withParams
  const withParams = (newParams) => {
    const combinedParams = { ...initialParams, ...newParams };
    const parametrizedName = `${name}(${JSON.stringify(combinedParams)})`;

    const parametrizedAction = createAction(callback, {
      name: parametrizedName,
      initialParams: combinedParams,
      parentAction: action,
    });

    // Copier les méthodes de connexion depuis l'action parent
    parametrizedAction.match = action.match;
    parametrizedAction.activationEffect = (options) => {
      action.activationEffect.call(parametrizedAction, options);
    };
    parametrizedAction.deactivationEffect = (options) => {
      action.deactivationEffect.call(parametrizedAction, options);
    };
    parametrizedAction.shouldReload = action.shouldReload;

    // Ajouter à la liste des actions paramétrées pour le GC
    const weakRef = new WeakRef(parametrizedAction);
    parametrizedActionWeakRefSet.add(weakRef);

    return parametrizedAction;
  };

  const action = {
    isMatchingSignal,
    initialParams,
    params,
    paramsSignal,
    load: ({ signal }) => callback({ signal, ...params }),
    stateSignal,
    error,
    errorSignal,
    reportError,
    data,
    dataSignal,

    match,
    activationEffect,
    deactivationEffect,
    shouldReload,
    toString,
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

  const activationEffect = ({ matchResult } = {}) => {
    // Utiliser les paramètres de l'action pour écrire en localStorage
    const valueToStore =
      action.params[paramName] || matchResult?.[paramName] || "";
    localStorage.setItem(key, valueToStore);
  };

  const deactivationEffect = () => {
    localStorage.removeItem(key);
  };

  action.activationEffect = activationEffect;
  action.deactivationEffect = deactivationEffect;
  onActionConnected();
};
