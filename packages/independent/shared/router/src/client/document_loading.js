import { signal } from "@preact/signals";

export const documentIsLoadingSignal = signal(true);
if (document.readyState === "complete") {
  documentIsLoadingSignal.value = false;
} else {
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
      documentIsLoadingSignal.value = false;
    }
  });
}
export const useDocumentIsLoading = () => {
  return documentIsLoadingSignal.value;
};
