import { signal } from "@preact/signals";

export const documentIsRoutingSignal = signal(false);
export const startDocumentRouting = () => {
  documentIsRoutingSignal.value = true;
};
export const endDocumentRouting = () => {
  documentIsRoutingSignal.value = false;
};
