import { computed } from "@preact/signals";
import { documentIsLoadingSignal } from "./document_loading.js";
import { documentIsNavigatingSignal } from "./document_navigating.js";

const routerReadyStateSignal = computed(() => {
  const documentIsLoading = documentIsLoadingSignal.value;
  if (documentIsLoading) {
    return "document_loading";
  }
  const documentIsNavigating = documentIsNavigatingSignal.value;
  if (documentIsNavigating) {
    return "document_navigating";
  }
  return "complete";
});
export const useRouterReadyState = () => {
  return routerReadyStateSignal.value;
};
export const useRouterIsBusy = () => {
  return routerReadyStateSignal.value !== "complete";
};
export const useCanStopLoad = () => {
  return routerReadyStateSignal.value !== "complete";
};
