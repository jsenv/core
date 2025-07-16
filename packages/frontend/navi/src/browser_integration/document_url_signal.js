import { signal } from "@preact/signals";

export const documentUrlSignal = signal(window.location.href);
export const useDocumentUrl = () => {
  return documentUrlSignal.value;
};
export const updateDocumentUrl = (value) => {
  documentUrlSignal.value = value;
};
