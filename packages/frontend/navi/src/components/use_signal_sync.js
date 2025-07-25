import { useSignal } from "@preact/signals";
import { useRef } from "preact/hooks";

/**
 * Creates a signal that stays synchronized with an external value,
 * only updating the signal when the value actually changes.
 *
 * @param {any} value - The external value to sync with
 * @param {any} [initialValue] - Optional initial value for the signal (defaults to value)
 * @returns {Signal} A signal that tracks the external value
 */
export const useSignalSync = (value, initialValue = value) => {
  const signal = useSignal(initialValue);
  const previousValueRef = useRef(value);

  if (previousValueRef.current !== value) {
    previousValueRef.current = value;
    signal.value = value;
  }

  return signal;
};
