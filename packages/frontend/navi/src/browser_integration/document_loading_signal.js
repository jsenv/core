import { computed, signal } from "@preact/signals";
import { executeWithCleanup } from "../utils/execute_with_cleanup.js";

export const windowIsLoadingSignal = signal(true);
if (document.readyState === "complete") {
  windowIsLoadingSignal.value = false;
} else {
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
      windowIsLoadingSignal.value = false;
    }
  });
}

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

export const documentIsWorkingSignal = signal(false);
export const workingWhile = (fn) => {
  documentIsWorkingSignal.value = true;
  return executeWithCleanup(fn, () => {
    documentIsWorkingSignal.value = false;
  });
};

export const documentIsBusySignal = computed(() => {
  return documentIsRoutingSignal.value || documentIsWorkingSignal.value;
});

const documentLoadingReasonArraySignal = computed(() => {
  const windowIsLoading = windowIsLoadingSignal.value;
  const documentIsRouting = documentIsRoutingSignal.value;
  const documentIsWorking = documentIsWorkingSignal.value;
  const reasonArray = [];
  if (windowIsLoading) {
    reasonArray.push("window_loading");
  }
  if (documentIsRouting) {
    reasonArray.push("document_routing");
  }
  if (documentIsWorking) {
    reasonArray.push("document_working");
  }
  return reasonArray;
});
export const useDocumentLoadingReasonArray = () => {
  return documentLoadingReasonArraySignal.value;
};
export const useDocumentIsLoading = () => {
  return documentLoadingReasonArraySignal.value.length > 0;
};
