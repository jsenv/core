import { useRef } from "preact/hooks";

/**
 * Hook that handles initial value setup and external value synchronization.
 *
 * @param {string} name - Parameter name for debugging
 * @param {any} externalValue - Value from props or parent component
 * @param {any} fallbackValue - Backup value if external value isn't useful
 * @param {any} defaultValue - Final fallback value
 * @param {Function} setValue - Function to call when value needs to be set
 * @param {Function} getValue - Function to get current value (for sync comparison)
 *
 * @returns {any} The resolved initial value
 */
export const useInitialValue = (
  name,
  externalValue,
  fallbackValue,
  defaultValue,
  setValue,
) => {
  const initialValue = resolveInitialValue(
    externalValue,
    fallbackValue,
    defaultValue,
  );

  // Set initial value on mount
  const mountedRef = useRef(false);
  if (!mountedRef.current) {
    mountedRef.current = true;
    if (name) {
      setValue(initialValue);
    }
  }

  // Track external value changes and sync them
  const previousExternalValueRef = useRef(externalValue);
  if (externalValue !== previousExternalValueRef.current) {
    previousExternalValueRef.current = externalValue;
    if (name && externalValue !== undefined && externalValue !== defaultValue) {
      setValue(externalValue);
    }
  }

  return initialValue;
};

/**
 * Picks the best initial value from three options using a simple priority system.
 *
 * @param {any} externalValue - Value from props or parent component
 * @param {any} fallbackValue - Backup value if external value isn't useful
 * @param {any} defaultValue - Final fallback (usually empty/neutral value)
 *
 * @returns {any} The chosen value using this priority:
 *   1. externalValue (if provided and different from default)
 *   2. fallbackValue (if external value is missing/same as default)
 *   3. defaultValue (if nothing else works)
 *
 * @example
 * resolveInitialValue("hello", "backup", "") → "hello"
 * resolveInitialValue(undefined, "backup", "") → "backup"
 * resolveInitialValue("", "backup", "") → "backup" (empty same as default)
 */
export const resolveInitialValue = (
  externalValue,
  fallbackValue,
  defaultValue,
) => {
  return externalValue === undefined || externalValue === defaultValue
    ? fallbackValue === undefined
      ? defaultValue
      : fallbackValue
    : externalValue;
};
