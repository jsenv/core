import { signal } from "@preact/signals";

export const documentHiddenSignal = signal(document.hidden);
document.addEventListener("visibilitychange", () => {
  documentHiddenSignal.value = document.hidden;
});
export const useDocumentHidden = () => {
  return documentHiddenSignal.value;
};

// for testing
export const simulateDocumentHidden = () => {
  documentHiddenSignal.value = true;
};
export const simulateDocumentVisible = () => {
  documentHiddenSignal.value = false;
};
