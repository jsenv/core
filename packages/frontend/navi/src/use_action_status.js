import { ABORTED, IDLE, LOADED, LOADING } from "./action_loading_states.js";
import { getActionPrivateProperties } from "./action_private_properties.js";

export const useActionStatus = (action) => {
  if (!action) {
    return {
      params: undefined,
      loadingState: IDLE,
      loadRequested: false,
      idle: true,
      preloading: false,
      loading: false,
      aborted: false,
      error: null,
      preloaded: false,
      loaded: false,
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
  const idle = loadingState === IDLE;
  const aborted = loadingState === ABORTED;
  const error = errorSignal.value;
  const loading = loadingState === LOADING;
  const preloading = loading && !loadRequested;
  const loaded = loadingState === LOADED;
  const preloaded = loaded && !loadRequested;
  const data = computedDataSignal.value;

  return {
    params,
    loadingState,
    loadRequested,
    idle,
    preloading,
    loading,
    aborted,
    error,
    preloaded,
    loaded,
    data,
  };
};
