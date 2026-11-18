import { computed, signal } from "@preact/signals";

import { executeWithCleanup } from "../../utils/execute_with_cleanup.js";

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

// What keeps the document busy: one entry per routing or per update of the
// actions started through it, taken out by its own end. Not by name: two runs
// of one verb (the child of `GAME.GET` two cards read, two unnamed actions)
// share a name, and the first one to end would say the document idle while the
// other is still out. The names are there to be read when debugging.
const routingPendingSignal = signal([]);
const workPendingSignal = signal([]);
const whilePending = (pendingSignal, fn, names, label) => {
  if (names.length === 0) {
    return fn();
  }
  const pending = { names };
  pendingSignal.value = [...pendingSignal.peek(), pending];
  if (import.meta.dev && DEBUG) {
    console.debug(`${label}: pending`, names);
  }
  return executeWithCleanup(fn, () => {
    pendingSignal.value = pendingSignal
      .peek()
      .filter((pendingEntry) => pendingEntry !== pending);
    if (import.meta.dev && DEBUG) {
      console.debug(
        `${label}: done`,
        names,
        "still pending:",
        pendingSignal.peek().map((pendingEntry) => pendingEntry.names),
      );
    }
  });
};
export const routingWhile = (fn, routeNames = []) => {
  return whilePending(routingPendingSignal, fn, routeNames, "routingWhile");
};
export const workingWhile = (fn, actionNames = []) => {
  return whilePending(workPendingSignal, fn, actionNames, "workingWhile");
};

export const documentIsBusySignal = computed(() => {
  return (
    routingPendingSignal.value.length > 0 || workPendingSignal.value.length > 0
  );
});

const documentLoadingReasonArraySignal = computed(() => {
  const windowIsLoading = windowIsLoadingSignal.value;
  const routesLoading = routingPendingSignal.value;
  const actionsLoading = workPendingSignal.value;
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
