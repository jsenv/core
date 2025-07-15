import { signal } from "@preact/signals";
import { executeWithCleanup } from "../utils/execute_with_cleanup.js";

export const documentIsRoutingSignal = signal(false);
export const useDocumentIsRouting = () => {
  return documentIsRoutingSignal.value;
};
export const startDocumentRouting = () => {
  documentIsRoutingSignal.value = true;
};
export const endDocumentRouting = () => {
  documentIsRoutingSignal.value = false;
};
export const routingWhile = (fn) => {
  startDocumentRouting();
  return executeWithCleanup(fn, endDocumentRouting);
};
