import { effect, signal } from "@preact/signals";
import { valueInLocalStorage } from "./value_in_local_storage.js";

/**
 * Creates an advanced signal with optional source signal synchronization and local storage persistence.
 *
 * The sourceSignal option creates a fallback mechanism where:
 * 1. The signal initially takes the value from sourceSignal (if defined) or falls back to defaultValue
 * 2. The signal can be manually overridden with any value
 * 3. When sourceSignal changes, it will override the current value again
 *
 * This is useful for scenarios like UI state management where you want to:
 * - Start with a value from an external source (e.g., backend data)
 * - Allow temporary local overrides (e.g., user interactions)
 * - Reset to the external source when context changes (e.g., navigation, data refresh)
 *
 * @param {any} defaultValue - The default value to use when no other value is available
 * @param {Object} [options={}] - Configuration options
 * @param {import("@preact/signals").Signal} [options.sourceSignal] - Source signal to synchronize with. When the source signal changes, this signal will be updated
 * @param {string} [options.localStorageKey] - Key for local storage persistence. When provided, the signal value will be saved to and restored from localStorage
 * @param {"string" | "number" | "boolean" | "object"} [options.type="string"] - Type for localStorage serialization/deserialization
 * @returns {import("@preact/signals").Signal} A signal that can be synchronized with a source signal and/or persisted in localStorage
 *
 * @example
 * // Basic signal with default value
 * const count = stateSignal(0);
 *
 * @example
 * // Position that follows backend data but allows temporary overrides
 * const backendPosition = signal({ x: 100, y: 50 });
 * const currentPosition = stateSignal({ x: 0, y: 0 }, { sourceSignal: backendPosition });
 *
 * // Initially: currentPosition.value = { x: 100, y: 50 } (from backend)
 * // User drags: currentPosition.value = { x: 150, y: 80 } (manual override)
 * // Backend updates: backendPosition.value = { x: 200, y: 60 }
 * // Result: currentPosition.value = { x: 200, y: 60 } (reset to new backend value)
 *
 * @example
 * // Signal with localStorage persistence
 * const userPreference = stateSignal("light", {
 *   localStorageKey: "theme",
 *   type: "string"
 * });
 *
 * @example
 * // Combined: follows source with localStorage backup
 * const serverConfig = signal({ timeout: 5000 });
 * const appConfig = stateSignal({ timeout: 3000 }, {
 *   sourceSignal: serverConfig,
 *   localStorageKey: "app-config",
 *   type: "object"
 * });
 */
export const stateSignal = (
  defaultValue,
  { sourceSignal, localStorageKey, type } = {},
) => {
  const advancedSignal = signal();
  if (sourceSignal) {
    connectSignalToSource(advancedSignal, sourceSignal, defaultValue);
  } else {
    advancedSignal.value = defaultValue;
  }
  if (localStorageKey) {
    connectSignalWithLocalStorage(advancedSignal, localStorageKey, { type });
  }
  return advancedSignal;
};

const connectSignalToSource = (signal, sourceSignal, defaultValue) => {
  connectSignalFallbacks(signal, [sourceSignal], defaultValue);
  updateSignalOnChange(sourceSignal, signal);
};
const connectSignalFallbacks = (signal, fallbackSignals, defaultValue) => {
  if (fallbackSignals.length === 0) {
    signal.value = defaultValue;
    return () => {};
  }
  if (fallbackSignals.length === 1) {
    const [fallbackSignal] = fallbackSignals;
    const applyFallback = () => {
      const value = signal.value;
      const fallbackValue = fallbackSignal.value;
      if (value !== undefined) {
        return;
      }
      if (fallbackValue !== undefined) {
        signal.value = fallbackValue;
        return;
      }
      signal.value = defaultValue;
    };
    applyFallback();
    return effect(() => {
      applyFallback();
    });
  }
  const applyFallback = () => {
    const fallbackValues = fallbackSignals.map((s) => s.value);
    const value = signal.value;
    if (value !== undefined) {
      return;
    }
    for (const fallbackValue of fallbackValues) {
      if (fallbackValue === undefined) {
        continue;
      }
      signal.value = fallbackValue;
      return;
    }
    signal.value = defaultValue;
  };
  applyFallback();
  return effect(() => {
    applyFallback();
  });
};
const updateSignalOnChange = (sourceSignal, targetSignal) => {
  let sourcePreviousValue = sourceSignal.value;
  return effect(() => {
    const sourceValue = sourceSignal.value;
    if (sourcePreviousValue !== undefined && sourceValue !== undefined) {
      // console.log(
      //   "value modified from",
      //   sourcePreviousValue,
      //   "to",
      //   sourceValue,
      // );
      targetSignal.value = sourceValue;
    }
    sourcePreviousValue = sourceValue;
  });
};

const connectSignalWithLocalStorage = (
  signal,
  key,
  { type = "string" } = {},
) => {
  const [get, set, remove] = valueInLocalStorage(key, { type });
  const valueFromLocalStorage = get();
  if (valueFromLocalStorage !== undefined) {
    signal.value = valueFromLocalStorage;
  }
  effect(() => {
    const value = signal.value;
    if (value === undefined || value === null) {
      remove();
    } else {
      set(value);
    }
  });
};
