import { signal, useSignal } from "@preact/signals";

let debug = false;

const sharedSignalCache = new WeakMap();
export const useActionParamsSignal = (action, initialValue) => {
  if (!action) {
    return useSignal(initialValue);
  }

  const existingSignal = sharedSignalCache.get(action);
  if (existingSignal) {
    if (debug && existingSignal.peek() !== initialValue) {
      console.warn(
        `⚠️ params signal for ${action} exists with different value!`,
        `\nExisting: ${existingSignal.peek()}`,
        `\nRequested: ${initialValue}`,
        `\nUsing existing value.`,
      );
    }
    return existingSignal;
  }

  const paramsSignal = signal(initialValue);
  sharedSignalCache.set(action, paramsSignal);
  if (debug) {
    console.debug(
      `Created params signal for ${action} with value:`,
      initialValue,
    );
  }
  return paramsSignal;
};
