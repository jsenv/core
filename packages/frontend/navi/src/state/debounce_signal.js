import { computed, effect, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";

export const debounceSignal = (
  signalToDebounce,
  { delay = 300, deepCompare = true, followsOnlyWhileRead = false } = {},
) => {
  const isSameValue = (a, b) =>
    deepCompare ? compareTwoJsValues(a, b) : a === b;
  let timeoutId;
  let latestValue = signalToDebounce.peek();
  // Following the source subscribes to it, and through it to whatever it reads:
  // an app-level signal it reads keeps it — and its timer — alive for as long
  // as that signal lives. Fine for a debounced value read at any time; a
  // binding's params (see getDebouncedSignal) are only read by the binding, and
  // are followed only while it is read.
  let stopFollowing = null;
  const follow = () => {
    const value = signalToDebounce.value;
    const debouncedValue = debouncedSignal.peek();
    if (isSameValue(value, debouncedValue)) {
      // The signal came back to where the debounced one already is: whatever it
      // passed through on the way is not on its way any more. Leaving the timer
      // armed would publish that in-between value once the delay elapses, and
      // settlingSignal would then say a newer value is coming, forever.
      clearTimeout(timeoutId);
      timeoutId = undefined;
      latestValue = debouncedValue;
      return;
    }
    clearTimeout(timeoutId);
    latestValue = value;
    timeoutId = setTimeout(() => {
      debouncedSignal.value = latestValue;
    }, delay);
  };
  const catchUp = () => {
    const value = signalToDebounce.peek();
    if (!isSameValue(value, debouncedSignal.peek())) {
      debouncedSignal.value = value;
    }
    latestValue = debouncedSignal.peek();
  };
  const debouncedSignal = signal(
    latestValue,
    followsOnlyWhileRead
      ? {
          watched: () => {
            // Nobody was waiting on what the source said while nothing read
            // it: that is taken at once, not after a delay.
            catchUp();
            stopFollowing = effect(follow);
          },
          unwatched: () => {
            stopFollowing();
            stopFollowing = null;
            clearTimeout(timeoutId);
            timeoutId = undefined;
          },
        }
      : undefined,
  );
  if (!followsOnlyWhileRead) {
    stopFollowing = effect(follow);
  }

  debouncedSignal.flush = () => {
    clearTimeout(timeoutId);
    timeoutId = undefined;
    if (stopFollowing) {
      debouncedSignal.value = latestValue;
      return;
    }
    catchUp();
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
  // A binding's params, read by the binding alone: followed while it is read
  // (see createActionProxyFromSignal), or a component's params reading an
  // app-level signal would stay subscribed after the component is gone.
  const debouncedSignal = debounceSignal(signalToDebounce, {
    delay,
    followsOnlyWhileRead: true,
  });
  byDelay.set(delay, debouncedSignal);
  return debouncedSignal;
};
