import { computed, signal } from "@preact/signals";
import { arraySignal } from "../utils/array_signal.js";
import { executeWithCleanup } from "../utils/execute_with_cleanup.js";

let DEBUG = false;
export const enableDebugOnDocumentLoading = () => {
  DEBUG = true;
};

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

const [
  documentLoadingRouteArraySignal,
  addToDocumentLoadingRouteArraySignal,
  removeFromDocumentLoadingRouteArraySignal,
] = arraySignal([]);
export { documentLoadingRouteArraySignal };
export const routingWhile = (fn, routeNames = []) => {
  if (DEBUG && routeNames.length > 0) {
    console.debug(`routingWhile: Adding routes to loading state:`, routeNames);
  }
  addToDocumentLoadingRouteArraySignal(...routeNames);
  return executeWithCleanup(fn, () => {
    removeFromDocumentLoadingRouteArraySignal(...routeNames);
    if (DEBUG && routeNames.length > 0) {
      console.debug(
        `routingWhile: Removed routes from loading state:`,
        routeNames,
        "state after removing:",
        documentLoadingRouteArraySignal.peek(),
      );
    }
  });
};

const [
  documentLoadingActionArraySignal,
  addToDocumentLoadingActionArraySignal,
  removeFromDocumentLoadingActionArraySignal,
] = arraySignal([]);
export { documentLoadingActionArraySignal };
export const workingWhile = (fn, actionNames = []) => {
  if (DEBUG && actionNames.length > 0) {
    console.debug(
      `workingWhile: Adding actions to loading state:`,
      actionNames,
    );
  }
  addToDocumentLoadingActionArraySignal(...actionNames);
  return executeWithCleanup(fn, () => {
    removeFromDocumentLoadingActionArraySignal(...actionNames);
    if (DEBUG && actionNames.length > 0) {
      console.debug(
        `routingWhile: Removed action from loading state:`,
        actionNames,
        "start after removing:",
        documentLoadingActionArraySignal.peek(),
      );
    }
  });
};

export const documentIsBusySignal = computed(() => {
  return (
    documentLoadingRouteArraySignal.value.length > 0 ||
    documentLoadingActionArraySignal.value.length > 0
  );
});

const documentLoadingReasonArraySignal = computed(() => {
  const windowIsLoading = windowIsLoadingSignal.value;
  const routesLoading = documentLoadingRouteArraySignal.value;
  const actionsLoading = documentLoadingActionArraySignal.value;
  const reasonArray = [];
  if (windowIsLoading) {
    reasonArray.push("window_loading");
  }
  if (routesLoading.length > 0) {
    reasonArray.push("document_routing");
  }
  if (actionsLoading.length > 0) {
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
