import { signal } from "@preact/signals";

export const documentStateSignal = signal(null);
export const useDocumentState = () => {
  return documentStateSignal.value;
};
export const updateDocumentState = (value) => {
  documentStateSignal.value = value;
};
