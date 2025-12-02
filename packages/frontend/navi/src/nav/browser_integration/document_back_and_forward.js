import { signal } from "@preact/signals";

export const canNavBackSignal = signal(false);
export const updateCanNavBack = (can) => {
  canNavBackSignal.value = can;
};
export const useCanNavBack = () => {
  return canNavBackSignal.value;
};

export const canNavForwardSignal = signal(false);
export const updateCanNavForward = (can) => {
  canNavForwardSignal.value = can;
};
export const useCanNavForward = () => {
  return canNavForwardSignal.value;
};
