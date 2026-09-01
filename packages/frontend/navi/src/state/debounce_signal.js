import { computed, effect, signal } from "@preact/signals";

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
  // Whoever reads the debounced value gets the previous one during the delay,
  // with nothing saying a newer one is on its way. This says it.
  debouncedSignal.settlingSignal = computed(() => {
    return !compareTwoJsValues(signalToDebounce.value, debouncedSignal.value);
  });

  return debouncedSignal;
};

const debouncedSignalCache = new WeakMap();

/**
 * The one debounced signal for a given source and delay.
 *
 * Two callers asking the same question of the same signal must wait on the same
 * answer: a debounced signal per caller is a timer per caller, and the actions
 * derived from them are then several instances of what is one request.
 */
export const getDebouncedSignal = (signalToDebounce, delay) => {
  let byDelay = debouncedSignalCache.get(signalToDebounce);
  if (!byDelay) {
    byDelay = new Map();
    debouncedSignalCache.set(signalToDebounce, byDelay);
  }
  const existing = byDelay.get(delay);
  if (existing) {
    return existing;
  }
  const debouncedSignal = debounceSignal(signalToDebounce, { delay });
  byDelay.set(delay, debouncedSignal);
  return debouncedSignal;
};
