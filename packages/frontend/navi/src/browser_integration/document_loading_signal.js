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

export const documentLoadingRouteArraySignal = signal([]);
const addRouteToLoading = (routeName) => {
  documentLoadingRouteArraySignal.value = [
    ...documentLoadingRouteArraySignal.value,
    routeName,
  ];
};
const removeRouteFromLoading = (routeName) => {
  documentLoadingRouteArraySignal.value =
    documentLoadingRouteArraySignal.value.filter((name) => name !== routeName);
};
export const routingWhile = (fn, routeNames = []) => {
  for (const routeName of routeNames) {
    addRouteToLoading(routeName);
  }
  return executeWithCleanup(fn, () => {
    for (const routeName of routeNames) {
      removeRouteFromLoading(routeName);
    }
  });
};

export const documentLoadingActionArraySignal = signal([]);
const addActionToLoading = (actionName) => {
  documentLoadingActionArraySignal.value = [
    ...documentLoadingActionArraySignal.value,
    actionName,
  ];
};
const removeActionFromLoading = (actionName) => {
  documentLoadingActionArraySignal.value =
    documentLoadingActionArraySignal.value.filter(
      (name) => name !== actionName,
    );
};
export const workingWhile = (fn, actionNames = []) => {
  for (const actionName of actionNames) {
    addActionToLoading(actionName);
  }
  return executeWithCleanup(fn, () => {
    for (const actionName of actionNames) {
      removeActionFromLoading(actionName);
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
