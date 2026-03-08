import { effect, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";

export const debounceSignal = (
  signalToDebounce,
  { delay = 300, deepCompare = true } = {},
) => {
  let timeoutId;
  let latestValue = signalToDebounce.peek();
  const debouncedSignal = signal(latestValue);

  effect(() => {
    const value = signalToDebounce.value;
    const debouncedValue = debouncedSignal.peek();
    if (
      deepCompare
        ? compareTwoJsValues(value, debouncedValue)
        : value === debouncedValue
    ) {
      return;
    }
    clearTimeout(timeoutId);
    latestValue = value;
    timeoutId = setTimeout(() => {
      debouncedSignal.value = latestValue;
    }, delay);
  });

  debouncedSignal.flush = () => {
    clearTimeout(timeoutId);
    debouncedSignal.value = latestValue;
  };

  return debouncedSignal;
};
