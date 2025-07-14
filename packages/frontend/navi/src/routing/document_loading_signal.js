import { signal } from "@preact/signals";

export const documentIsLoadingSignal = signal(true);
export const useDocumentIsLoading = () => {
  return documentIsLoadingSignal.value;
};
const updateDocumentIsLoading = (value) => {
  documentIsLoadingSignal.value = value;
};
if (document.readyState === "complete") {
  updateDocumentIsLoading(false);
} else {
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
      updateDocumentIsLoading(false);
    }
  });
}
