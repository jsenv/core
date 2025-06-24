import { computed, effect, signal } from "@preact/signals";
import {
  getActionPrivateProperties,
  setActionPrivateProperties,
} from "./actions.js";
import { isSignal } from "./actions_helpers.js";

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

  // Valeur primitive
  const paramsSignal = signal(paramsMapOrSignal);
  return createActionProxyFromSignal(action, paramsSignal, options);
};
const createActionProxyFromSignal = (
  action,
  paramsSignal,
  { reloadOnChange = true, onChange } = {},
) => {
  const getActionForParams = () => {
    const params = paramsSignal.value;
    if (!params) {
      return null;
    }
    return action.bindParams(params);
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
    name: `Proxy on ${action.name}`,
    params: action.initialParams,
    loadRequested: action.initialLoadRequested,
    loadingState: action.initialLoadingState,
    error: action.initialError,
    data: action.initialData,
    preload: proxyMethod("preload"),
    load: proxyMethod("load"),
    reload: proxyMethod("reload"),
    unload: proxyMethod("unload"),
    toString: () => `Proxy on ${action.name}`,
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
        const initialValue = action[initialValuePrivatePropertyName];
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
      : `[[Proxy]] ${action.name}`;
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
    ui: action.ui,
  };
  setActionPrivateProperties(actionProxy, proxyPrivateProperties);

  return actionProxy;
};
