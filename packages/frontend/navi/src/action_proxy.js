import { computed, effect, signal } from "@preact/signals";
import {
  getActionPrivateProperties,
  setActionPrivateProperties,
} from "./action_private_properties.js";
import { isSignal } from "./actions_helpers.js";

let debug = false;

export const createActionProxy = (action, paramsMapOrSignal, options = {}) => {
  if (isSignal(paramsMapOrSignal)) {
    return createActionProxyFromSignal(action, paramsMapOrSignal, options);
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
      return action.bindParams(paramsMapOrSignal);
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
    return createActionProxyFromSignal(action, paramsSignal, options);
  }

  return action.bindParams(paramsMapOrSignal);
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
    toString: () => actionProxy.name,
  };
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
    onActionTargetChange(() => {
      if (debug) {
        console.debug(
          `listening "${signalPropertyName}" on "${currentAction}"`,
        );
      }
      const dispose = effect(() => {
        const currentActionSignal =
          currentActionPrivateProperties[signalPropertyName];
        const currentActionSignalValue = currentActionSignal.value;
        if (debug) {
          console.debug(
            `"${signalPropertyName}" value is "${currentActionSignalValue}"`,
          );
        }
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
    ui: undefined,
  };
  onActionTargetChange(() => {
    proxyPrivateProperties.ui = currentAction.ui;
  });
  setActionPrivateProperties(actionProxy, proxyPrivateProperties);

  {
    let actionTargetPrevious = null;
    let isFirstEffect = true;
    const changeCleanupCallbackSet = new Set();
    effect(() => {
      actionTargetPrevious = actionTarget;
      const params = paramsSignal.value;
      if (params) {
        actionTarget = action.bindParams(params);
        currentAction = actionTarget;
        currentActionPrivateProperties =
          getActionPrivateProperties(actionTarget);
      } else {
        actionTarget = null;
        currentAction = action;
        currentActionPrivateProperties = getActionPrivateProperties(action);
      }

      if (isFirstEffect) {
        isFirstEffect = false;
      }
      for (const changeCleanupCallback of changeCleanupCallbackSet) {
        changeCleanupCallback();
      }
      changeCleanupCallbackSet.clear();
      for (const callback of actionTargetChangeCallbackSet) {
        const returnValue = callback(actionTarget, actionTargetPrevious);
        if (typeof returnValue === "function") {
          changeCleanupCallbackSet.add(returnValue);
        }
      }
      actionTargetPrevious = actionTarget;
    });
  }

  if (reloadOnChange) {
    onActionTargetChange((actionTarget, actionTargetPrevious) => {
      if (actionTargetPrevious.loadRequested) {
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
