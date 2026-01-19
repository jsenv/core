import { effect, signal } from "@preact/signals";

import { valueInLocalStorage } from "./value_in_local_storage.js";

// Global signal registry for route template detection
const globalSignalRegistry = new Map();
let signalIdCounter = 0;
const generateSignalId = () => {
  return `__jsenv_signal_${++signalIdCounter}__`;
};

// Function to detect signals in route patterns and connect them
export const detectSignals = (routePattern) => {
  const signalConnections = [];

  // Look for signals in the new syntax: :paramName=__jsenv_signal_1__ or ?paramName=__jsenv_signal_1__
  const signalParamRegex = /([?:])(\w+)=(__jsenv_signal_\d+__)/g;
  let match;
  let updatedPattern = routePattern;

  while ((match = signalParamRegex.exec(routePattern)) !== null) {
    const [fullMatch, prefix, paramName, signalId] = match;
    const signalData = globalSignalRegistry.get(signalId);

    if (signalData) {
      const { signal, options } = signalData;

      let replacement;
      if (prefix === ":") {
        // Path parameter: :section=__jsenv_signal_1__ becomes :section
        replacement = `${prefix}${paramName}`;
      } else {
        // Search parameter: ?tab=__jsenv_signal_1__ becomes nothing (removed entirely)
        replacement = "";
      }
      updatedPattern = updatedPattern.replace(fullMatch, replacement);

      signalConnections.push({
        signal,
        paramName,
        options,
      });
    }
  }

  return {
    pattern: updatedPattern,
    connections: signalConnections,
  };
};

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
 * @param {string} [options.localStorage] - Key for local storage persistence. When provided, the signal value will be saved to and restored from localStorage
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
 *   localStorage: "theme",
 *   type: "string"
 * });
 *
 * @example
 * // Combined: follows source with localStorage backup
 * const serverConfig = signal({ timeout: 5000 });
 * const appConfig = stateSignal({ timeout: 3000 }, {
 *   sourceSignal: serverConfig,
 *   localStorage: "app-config",
 *   type: "object"
 * });
 */
const NO_LOCAL_STORAGE = [() => undefined, () => {}, () => {}];
export const stateSignal = (defaultValue, options = {}) => {
  const {
    type = "string",
    oneOf,
    autoFix,
    sourceSignal,
    localStorage,
    debug,
  } = options;

  const [readFromLocalStorage, writeIntoLocalStorage, removeFromLocalStorage] =
    localStorage
      ? valueInLocalStorage(localStorage, { type })
      : NO_LOCAL_STORAGE;
  const getFallbackValue = () => {
    const valueFromLocalStorage = readFromLocalStorage();
    if (valueFromLocalStorage !== undefined) {
      if (debug) {
        console.debug(
          `[stateSignal] using value from localStorage "${localStorage}"=${valueFromLocalStorage}`,
        );
      }
      return valueFromLocalStorage;
    }
    if (sourceSignal) {
      const sourceValue = sourceSignal.peek();
      if (sourceValue !== undefined) {
        if (debug) {
          console.debug(
            `[stateSignal] using value from source signal=${sourceValue}`,
          );
        }
        return sourceValue;
      }
    }
    if (debug) {
      console.debug(`[stateSignal] using default value=${defaultValue}`);
    }
    return defaultValue;
  };

  const advancedSignal = signal(getFallbackValue());

  // Register signal globally and make it work with template literals
  const signalId = generateSignalId();
  advancedSignal.__signalId = signalId;
  advancedSignal.toString = () => signalId;

  // Store signal with its options for later route connection
  globalSignalRegistry.set(signalId, {
    signal: advancedSignal,
    options: {
      getFallbackValue,
      defaultValue,
      type,
      localStorage,
      debug,
      ...options,
    },
  });

  const validity = { valid: true };
  advancedSignal.validity = validity;

  // ensure current value always fallback to
  // 1. source signal
  // 2. local storage
  // 3. default value
  fallback: {
    let firstRun = true;
    effect(() => {
      const value = advancedSignal.value;
      if (sourceSignal) {
        // eslint-disable-next-line no-unused-expressions
        sourceSignal.value;
      }
      if (firstRun) {
        firstRun = true;
        return;
      }
      if (value !== undefined) {
        return;
      }
      advancedSignal.value = getFallbackValue();
    });
  }
  // When source signal value is updated, it overrides current signal value
  source_signal_override: {
    if (!sourceSignal) {
      break source_signal_override;
    }

    let sourcePreviousValue = sourceSignal.value;
    effect(() => {
      const sourceValue = sourceSignal.value;
      if (sourcePreviousValue === undefined) {
        // first run
      } else if (sourceValue === undefined) {
        // we don't have anything in the source signal, keep current value
      } else {
        // the case we want to support: source signal value changes -> override current value
        if (debug) {
          console.debug(`[stateSignal] source signal updated`, {
            sourcePreviousValue,
            sourceValue,
          });
        }
        advancedSignal.value = sourceValue;
      }
      sourcePreviousValue = sourceValue;
    });
  }
  // Read/write into local storage when enabled
  persist_in_local_storage: {
    if (!localStorage) {
      break persist_in_local_storage;
    }
    effect(() => {
      const value = advancedSignal.value;
      if (value === undefined || value === null || value === defaultValue) {
        if (debug) {
          console.debug(
            `[stateSignal] removing "${localStorage}" from localStorage`,
          );
        }
        removeFromLocalStorage();
      } else {
        if (debug) {
          console.debug(
            `[stateSignal] writing into localStorage "${localStorage}"=${value}`,
          );
        }
        writeIntoLocalStorage(value);
      }
    });
  }
  // update validity object according to the advanced signal value
  validation: {
    effect(() => {
      const value = advancedSignal.value;
      updateValidity({ oneOf }, validity, value);
      if (!validity.valid && autoFix) {
        advancedSignal.value = autoFix();
        return;
      }
    });
  }

  return advancedSignal;
};

const updateValidity = (rules, validity, value) => {
  const { oneOf } = rules;
  if (oneOf && !oneOf.includes(value)) {
    validity.valid = false;
    return;
  }
  validity.valid = true;
};

// const connectSignalFallbacks = (signal, fallbackSignals, defaultValue) => {
//   if (fallbackSignals.length === 0) {
//     signal.value = defaultValue;
//     return () => {};
//   }
//   if (fallbackSignals.length === 1) {
//     const [fallbackSignal] = fallbackSignals;
//     const applyFallback = () => {
//       const value = signal.value;
//       const fallbackValue = fallbackSignal.value;
//       if (value !== undefined) {
//         return;
//       }
//       if (fallbackValue !== undefined) {
//         signal.value = fallbackValue;
//         return;
//       }
//       signal.value = defaultValue;
//     };
//     applyFallback();
//     return effect(() => {
//       applyFallback();
//     });
//   }
//   const applyFallback = () => {
//     const fallbackValues = fallbackSignals.map((s) => s.value);
//     const value = signal.value;
//     if (value !== undefined) {
//       return;
//     }
//     for (const fallbackValue of fallbackValues) {
//       if (fallbackValue === undefined) {
//         continue;
//       }
//       signal.value = fallbackValue;
//       return;
//     }
//     signal.value = defaultValue;
//   };
//   applyFallback();
//   return effect(() => {
//     applyFallback();
//   });
// };
// const updateSignalOnChange = (sourceSignal, targetSignal) => {
//   let sourcePreviousValue = sourceSignal.value;
//   return effect(() => {
//     const sourceValue = sourceSignal.value;
//     if (sourcePreviousValue !== undefined && sourceValue !== undefined) {
//       // console.log(
//       //   "value modified from",
//       //   sourcePreviousValue,
//       //   "to",
//       //   sourceValue,
//       // );
//       targetSignal.value = sourceValue;
//     }
//     sourcePreviousValue = sourceValue;
//   });
// };
