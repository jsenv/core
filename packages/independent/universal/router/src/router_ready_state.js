import { computed } from "@preact/signals";
import { documentIsLoadingSignal } from "./document_loading.js";
import { documentIsRoutingSignal } from "./document_routing.js";

const routerReadyStateSignal = computed(() => {
  const documentIsLoading = documentIsLoadingSignal.value;
  if (documentIsLoading) {
    return "document_loading";
  }
  const documentIsRouting = documentIsRoutingSignal.value;
  if (documentIsRouting) {
    return "document_routing";
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
