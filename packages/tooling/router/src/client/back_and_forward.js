import { signal } from "@preact/signals";

export const canGoBackSignal = signal(false);
export const updateCanGoBack = (can) => {
  canGoBackSignal.value = can;
};
export const useCanGoBack = () => {
  return canGoBackSignal.value;
};

export const canGoForwardSignal = signal(false);
export const updateCanGoForward = (can) => {
  canGoBackSignal.value = can;
};
export const useCanGoForward = () => {
  return canGoForwardSignal.value;
};
