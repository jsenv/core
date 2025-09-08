import { useRef } from "preact/hooks";

let debug = false;

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
  if (externalValue !== undefined && externalValue !== defaultValue) {
    return externalValue;
  }
  if (fallbackValue !== undefined) {
    return fallbackValue;
  }
  return defaultValue;
};

/**
 * Hook that syncs external value changes to a setState function.
 * Always syncs when external value changes, regardless of what it changes to.
 *
 * @param {any} externalValue - Value from props or parent component to watch for changes
 * @param {any} defaultValue - Default value to use when external value is undefined
 * @param {Function} setValue - Function to call when external value changes
 * @param {string} name - Parameter name for debugging
 */
export const useExternalValueSync = (
  externalValue,
  defaultValue,
  setValue,
  name = "",
) => {
  // Track external value changes and sync them
  const previousExternalValueRef = useRef(externalValue);
  if (externalValue !== previousExternalValueRef.current) {
    previousExternalValueRef.current = externalValue;
    // Always sync external value changes - use defaultValue only when external is undefined
    const valueToSet =
      externalValue === undefined ? defaultValue : externalValue;
    if (debug) {
      console.debug(
        `useExternalValueSync(${name}) syncing external value change: ${valueToSet}`,
      );
    }
    setValue(valueToSet);
  }
};

/**
 * Hook that handles initial value setup and external value synchronization.
 *
 * @param {string} name - Parameter name for debugging
 * @param {any} externalValue - Value from props or parent component
 * @param {any} fallbackValue - Backup value if external value isn't useful
 * @param {any} defaultValue - Final fallback value
 * @param {Function} setValue - Function to call when value needs to be set
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
    setValue(initialValue);
  }

  // Use the new sync hook
  useExternalValueSync(externalValue, defaultValue, setValue, name);

  return initialValue;
};
