import { effect, signal } from "@preact/signals";

import { getRoutePrivateProperties } from "../nav/route.js";
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
  {
    type = "string",
    localStorageKey,
    routes,
    sourceSignal,
    oneOf,
    invalidEffect,
  } = {},
) => {
  const [readFromLocalStorage, writeIntoLocalStorage, removeFromLocalStorage] =
    localStorageKey
      ? valueInLocalStorage(localStorageKey, { type })
      : [() => undefined, () => {}, () => {}];
  const getDefaultValue = () => {
    if (sourceSignal) {
      const sourceValue = sourceSignal.peek();
      if (sourceValue !== undefined) {
        return sourceValue;
      }
    }
    const valueFromLocalStorage = readFromLocalStorage();
    if (valueFromLocalStorage === undefined) {
      return defaultValue;
    }
    return valueFromLocalStorage;
  };
  const advancedSignal = signal(getDefaultValue());

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
      advancedSignal.value = getDefaultValue();
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
        advancedSignal.value = sourceValue;
      }
      sourcePreviousValue = sourceValue;
    });
  }
  // Read/write into local storage when enabled
  persist_in_local_storage: {
    if (!localStorageKey) {
      break persist_in_local_storage;
    }
    effect(() => {
      const value = advancedSignal.value;
      if (value === undefined || value === null) {
        removeFromLocalStorage();
      } else {
        writeIntoLocalStorage(value);
      }
    });
  }

  if (routes) {
    for (const paramName of Object.keys(routes)) {
      const route = routes[paramName];
      route.describeParam(paramName, {
        defaultValue: getDefaultValue,
        invalidEffect,
      });
      const { matchingSignal, rawParamsSignal } =
        getRoutePrivateProperties(route);
      effect(() => {
        const matching = matchingSignal.value;
        const params = rawParamsSignal.value;
        const urlParamValue = params[paramName];
        const stateValue = advancedSignal.value;

        if (!matching) {
          return;
        }
        if (urlParamValue === stateValue) {
          // nothing to do
          return;
        }
        if (
          oneOf &&
          !oneOf.includes(urlParamValue) &&
          invalidEffect === "redirect"
        ) {
          route.navTo({
            ...params,
            [paramName]: defaultValue === undefined ? oneOf[0] : defaultValue,
          });
          return;
        }

        advancedSignal.value = urlParamValue;
      });
    }
  }

  return advancedSignal;
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
