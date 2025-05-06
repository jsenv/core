import { IDLE, LOADING, ABORTED, LOADED } from "./route_status.js";
import { documentUrlSignal } from "../document_url.js";

export const useRouteUrl = (route, params) => {
  const documentUrl = documentUrlSignal.value;
  return route.buildUrl(documentUrl, params);
};

export const useRouteStatus = (route) => {
  const pending = route.loadingStateSignal.value === LOADING;
  const error = route.errorSignal.value;
  const aborted = route.loadingStateSignal.value === ABORTED;
  return { aborted, pending, error };
};

export const useRouteLoadingState = (route) => {
  const loadingState = route.loadingStateSignal.value;
  if (loadingState === IDLE) {
    return "idle";
  }
  if (loadingState === LOADING) {
    return "loading";
  }
  if (loadingState === ABORTED) {
    return "aborted";
  }
  if (loadingState.error) {
    return "load_error";
  }
  return "loaded";
};

export const useRouteIsMatching = (route) => {
  return route.isMatchingSignal.value;
};

export const useRouteIsLoading = (route) => {
  return route.loadingStateSignal.value === LOADING;
};

export const useRouteLoadIsAborted = (route) => {
  return route.loadingStateSignal.value === ABORTED;
};

export const useRouteIsLoaded = (route) => {
  return route.loadingStateSignal.value === LOADED;
};

export const useRouteError = (route) => {
  return route.errorSignal.value;
};

export const useRouteData = (route) => {
  return route.dataSignal.value;
};
