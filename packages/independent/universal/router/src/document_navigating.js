import { signal } from "@preact/signals";

export const documentIsNavigatingSignal = signal(false);
export const startDocumentNavigation = () => {
  documentIsNavigatingSignal.value = true;
};
export const endDocumentNavigation = () => {
  documentIsNavigatingSignal.value = false;
};
