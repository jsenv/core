import { computed, signal } from "@preact/signals";
import { executeWithCleanup } from "../utils/execute_with_cleanup.js";

export const windowIsLoadingSignal = signal(true);
if (document.readyState === "complete") {
  windowIsLoadingSignal(false);
} else {
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
      windowIsLoadingSignal(false);
    }
  });
}
export const useWindowIsLoading = () => {
  return windowIsLoadingSignal.value;
};

export const documentIsRoutingSignal = signal(false);
const startDocumentRouting = () => {
  documentIsRoutingSignal.value = true;
};
const endDocumentRouting = () => {
  documentIsRoutingSignal.value = false;
};
export const routingWhile = (fn) => {
  startDocumentRouting();
  return executeWithCleanup(fn, endDocumentRouting);
};

export const someActionIsLoadingSignal = signal(false);

const documentLoadingReasonArraySignal = computed(() => {
  const windowIsLoading = windowIsLoadingSignal.value;
  const documentIsRouting = documentIsRoutingSignal.value;
  const someActionIsLoading = someActionIsLoadingSignal.value;
  const reasonArray = [];
  if (windowIsLoading) {
    reasonArray.push("window_loading");
  }
  if (documentIsRouting) {
    reasonArray.push("document_routing");
  }
  if (someActionIsLoading) {
    reasonArray.push("some_action_loading");
  }
  return reasonArray;
});
export const useDocumentLoadingReasonArray = () => {
  return documentLoadingReasonArraySignal.value;
};
export const useDocumentIsLoading = () => {
  return documentLoadingReasonArraySignal.value.length > 0;
};
