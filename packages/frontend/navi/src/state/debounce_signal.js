import { effect, signal } from "@preact/signals";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";

export const debounceSignal = (signalToDebounce, delay = 300) => {
  let timeoutId;
  const debouncedSignal = signal(signalToDebounce.peek());

  effect(() => {
    const value = signalToDebounce.value;
    const debouncedValue = debouncedSignal.peek();
    if (compareTwoJsValues(value, debouncedValue)) {
      return;
    }
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      debouncedSignal.value = value;
    }, delay);
  });

  return debouncedSignal;
};
