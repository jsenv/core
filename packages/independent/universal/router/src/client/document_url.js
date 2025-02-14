import { signal } from "@preact/signals";

export const documentUrlSignal = signal(window.location.href);
export const updateDocumentUrl = (value) => {
  documentUrlSignal.value = value;
};
export const useDocumentUrl = () => {
  return documentUrlSignal.value;
};
