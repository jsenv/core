import { ABORTED, IDLE, LOADED, LOADING } from "./action_loading_states.js";
import { getActionPrivateProperties } from "./action_private_properties.js";

export const useActionStatus = (action) => {
  if (!action) {
    return {
      params: undefined,
      idle: true,
      error: null,
      aborted: false,
      pending: false,
      preloaded: false,
      data: undefined,
    };
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
  const preloading = loadingState === LOADING && !loadRequested;
  const preloaded = loadingState === LOADED && !loadRequested;
  const data = computedDataSignal.value;

  return {
    params,
    idle,
    error,
    aborted,
    pending,
    preloading,
    preloaded,
    data,
  };
};
