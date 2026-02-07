import { createValidity } from "@jsenv/validity";
import { effect, signal } from "@preact/signals";

import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { valueInLocalStorage } from "./value_in_local_storage.js";

// Global signal registry for route template detection
export const globalSignalRegistry = new Map();
let signalIdCounter = 0;
const generateSignalId = () => {
  const id = signalIdCounter++;
  return id;
};

/**
 * Creates an advanced signal with dynamic default value, local storage persistence, and validation.
 *
 * The first parameter can be either a static value or a signal acting as a "dynamic default":
 * - If a static value: traditional default behavior
 * - If a signal: acts as a dynamic default that updates the signal ONLY when no explicit value has been set
 *
 * Dynamic default behavior (when first param is a signal):
 * 1. Initially takes value from the default signal
 * 2. When explicitly set (programmatically or via localStorage), the explicit value takes precedence
 * 3. When default signal changes, it only updates if no explicit value was ever set
 * 4. Calling reset() or setting to undefined makes the signal use the dynamic default again
 * 5. If dynamic default is undefined and options.default is provided, uses the static fallback
 *
 * This is useful for:
 * - Backend data that can change but shouldn't override user preferences
 * - Route parameters with dynamic defaults based on other state
 * - Cascading configuration where defaults can be updated without losing user customizations
 * - Having a static fallback when dynamic defaults might be undefined
 *
 * @param {any|import("@preact/signals").Signal} defaultValue - Static default value OR signal for dynamic default behavior
 * @param {Object} [options={}] - Configuration options
 * @param {string|number} [options.id] - Custom ID for the signal. If not provided, an auto-generated ID will be used. Used for localStorage key and route pattern detection.
 * @param {any} [options.default] - Static fallback value used when defaultValue is a signal and that signal's value is undefined
 * @param {boolean} [options.persists=false] - Whether to persist the signal value in localStorage using the signal ID as key
 * @param {"string" | "number" | "boolean" | "object"} [options.type="string"] - Type for localStorage serialization/deserialization
 * @param {number} [options.step] - For number type: step size for precision. Values will be rounded to nearest multiple of step.
 * @param {Array} [options.oneOf] - Array of valid values for validation. Signal will be marked invalid if value is not in this array
 * @param {boolean} [options.debug=false] - Enable debug logging for this signal's operations
 * @returns {import("@preact/signals").Signal} A signal that can be synchronized with a source signal and/or persisted in localStorage. The signal includes a `validity` property for validation state.
 *
 * @example
 * // Basic signal with default value
 * const count = stateSignal(0);
 *
 * @example
 * // Signal with custom ID and persistence
 * const theme = stateSignal("light", {
 *   id: "user-theme",
 *   persists: true,
 *   type: "string"
 * });
 *
 * @example
 * // Signal with validation and auto-fix
 * const tab = stateSignal("overview", {
 *   id: "current-tab",
 *   oneOf: ["overview", "details", "settings"],
 *   autoFix: () => "overview",
 *   persists: true
 * });
 *
 * @example
 * // Dynamic default that doesn't override user choices
 * const backendTheme = signal("light");
 * const userTheme = stateSignal(backendTheme, { persists: true });
 *
 * // Initially: userTheme.value = "light" (from dynamic default)
 * // User sets: userTheme.value = "dark" (explicit choice, persisted)
 * // Backend changes: backendTheme.value = "blue"
 * // Result: userTheme.value = "dark" (user choice preserved)
 * // Reset: userTheme.value = undefined; // Now follows dynamic default again
 *
 * @example
 * // Dynamic default with static fallback
 * const backendValue = signal(undefined); // might be undefined initially
 * const userValue = stateSignal(backendValue, {
 *   default: "fallback",
 *   persists: true
 * });
 *
 * // Initially: userValue.value = "fallback" (static fallback since dynamic is undefined)
 * // Backend loads: backendValue.value = "loaded"; userValue.value = "loaded" (follows dynamic)
 * // User sets: userValue.value = "custom" (explicit choice, persisted)
 * // Backend changes: backendValue.value = "updated"
 * // Result: userValue.value = "custom" (user choice preserved)
 * // Reset: userValue.value = undefined; userValue.value = "updated" (follows dynamic again)
 *
 * @example
 * // Route parameter with dynamic default from parent route
 * const parentTab = signal("overview");
 * const childTab = stateSignal(parentTab);
 * // childTab follows parentTab changes unless explicitly set
 */
const NO_LOCAL_STORAGE = [() => undefined, () => {}, () => {}];
export const stateSignal = (defaultValue, options = {}) => {
  const {
    id,
    type,
    min,
    max,
    step,
    oneOf,
    persists = false,
    debug,
    default: staticFallback,
  } = options;

  // Check if defaultValue is a signal (dynamic default) or static value
  const isDynamicDefault =
    defaultValue &&
    typeof defaultValue === "object" &&
    "value" in defaultValue &&
    "peek" in defaultValue;
  const dynamicDefaultSignal = isDynamicDefault ? defaultValue : null;
  const staticDefaultValue = isDynamicDefault ? staticFallback : defaultValue;
  const signalId = id || generateSignalId();
  // Convert numeric IDs to strings for consistency
  const signalIdString = String(signalId);
  if (globalSignalRegistry.has(signalIdString)) {
    const conflictInfo = globalSignalRegistry.get(signalIdString);
    throw new Error(
      `Signal ID conflict: A signal with ID "${signalIdString}" already exists (existing default: ${conflictInfo.options.getDefaultValue()})`,
    );
  }

  // Determine localStorage key: use id if persists=true, or legacy localStorage option
  const localStorageKey = signalIdString;
  const [readFromLocalStorage, writeIntoLocalStorage, removeFromLocalStorage] =
    persists
      ? valueInLocalStorage(localStorageKey, {
          type: localStorageTypeMap[type] || type,
        })
      : NO_LOCAL_STORAGE;

  /**
   * Returns the current default value from code logic only (static or dynamic).
   * NEVER considers localStorage - used for URL building and route matching.
   *
   * @returns {any} The current code default value, undefined if no default
   */
  const getDefaultValue = (internalCall) => {
    if (dynamicDefaultSignal) {
      const dynamicValue = dynamicDefaultSignal.peek();
      if (dynamicValue === undefined) {
        if (staticDefaultValue === undefined) {
          return undefined;
        }
        if (debug && internalCall) {
          console.debug(
            `[stateSignal:${signalIdString}] dynamic default is undefined, using static default=${staticDefaultValue}`,
          );
        }
        return staticDefaultValue;
      }
      if (debug && internalCall) {
        console.debug(
          `[stateSignal:${signalIdString}] using value from dynamic default signal=${dynamicValue}`,
        );
      }
      return dynamicValue;
    }
    if (debug && internalCall) {
      console.debug(
        `[stateSignal:${signalIdString}] using static default value=${staticDefaultValue}`,
      );
    }
    return staticDefaultValue;
  };

  /**
   * Returns fallback value: localStorage first, then code default.
   * Used for signal initialization and resets.
   *
   * @returns {any} The fallback value (localStorage or code default)
   */
  const getFallbackValue = () => {
    if (persists) {
      const valueFromLocalStorage = readFromLocalStorage();
      if (valueFromLocalStorage !== undefined) {
        if (debug) {
          console.debug(
            `[stateSignal:${signalIdString}] using value from localStorage "${localStorageKey}"=${valueFromLocalStorage}`,
          );
        }
        return valueFromLocalStorage;
      }
    }
    return getDefaultValue(true);
  };
  const isCustomValue = (value) => {
    if (value === undefined) {
      return false;
    }
    if (dynamicDefaultSignal) {
      const dynamicValue = dynamicDefaultSignal.peek();
      if (dynamicValue === undefined) {
        return !compareTwoJsValues(value, staticDefaultValue, {
          ignoreArrayOrder: true,
        });
      }
      return !compareTwoJsValues(value, dynamicValue, {
        ignoreArrayOrder: true,
      });
    }
    return !compareTwoJsValues(value, staticDefaultValue, {
      ignoreArrayOrder: true,
    });
  };

  // Create signal with initial value: use stored value, or undefined to indicate no explicit value
  const [validity, updateValidity] = createValidity({
    type,
    min,
    max,
    step,
    oneOf,
  });
  const processValue = (value) => {
    const wasValid = validity.valid;
    updateValidity(value);
    if (validity.valid) {
      if (!wasValid) {
        if (debug) {
          console.debug(
            `[stateSignal:${signalIdString}] validation now passes`,
            { value },
          );
        }
      }
      return value;
    }
    if (debug) {
      console.debug(`[stateSignal:${signalIdString}] validation failed`, {
        value,
        min,
        max,
        step,
        oneOf,
        hasAutoFix: Boolean(validity.validSuggestion),
      });
    }
    if (validity.validSuggestion) {
      const validValue = validity.validSuggestion.value;
      if (debug) {
        console.debug(
          `[stateSignal:${signalIdString}] autoFix applied: ${value} → ${validValue}`,
          {
            value,
            validValue,
          },
        );
      }
      return validValue;
    }
    return value;
  };
  const preactSignal = signal(processValue(getFallbackValue()));

  // Create wrapper signal that applies step rounding on setValue
  const facadeSignal = {
    get value() {
      return preactSignal.value;
    },
    set value(newValue) {
      preactSignal.value = processValue(newValue);
    },
    peek() {
      return preactSignal.peek();
    },
    subscribe(fn) {
      return preactSignal.subscribe(fn);
    },
    valueOf() {
      return preactSignal.valueOf();
    },
  };

  facadeSignal.validity = validity;
  facadeSignal.__signalId = signalIdString;
  facadeSignal.toString = () => `{navi_state_signal:${signalIdString}}`;
  // 1. when signal value changes to undefined, it needs to fallback to default value
  // 2. when dynamic default changes and signal value is not custom, it needs to update
  undefined_effect: {
    let isFirstRun = true;
    effect(() => {
      const value = preactSignal.value;
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      if (value !== undefined) {
        return;
      }
      const defaultValue = getDefaultValue(true);
      if (defaultValue === value) {
        return;
      }
      if (debug) {
        console.debug(
          `[stateSignal:${signalIdString}] becomes undefined, reset to ${defaultValue}`,
        );
      }
      facadeSignal.value = defaultValue;
    });
  }
  dynamic_signal_effect: {
    if (!dynamicDefaultSignal) {
      break dynamic_signal_effect;
    }
    // here we listen only on the dynamic default signal
    let isFirstRun = true;
    let dynamicDefaultPreviousValue;
    effect(() => {
      const value = preactSignal.peek();
      const dynamicDefaultValue = dynamicDefaultSignal.value;
      if (isFirstRun) {
        isFirstRun = false;
        dynamicDefaultPreviousValue = dynamicDefaultValue;
        return;
      }
      // Check if current signal value matches the PREVIOUS dynamic default
      // If so, it was following the dynamic default and should update
      // Special case: if previous was undefined and we were using static fallback
      let wasFollowingDefault = false;
      if (
        dynamicDefaultPreviousValue === undefined &&
        staticDefaultValue !== undefined
      ) {
        // Signal might have been using static fallback
        wasFollowingDefault = value === staticDefaultValue;
      } else {
        // Signal was following the previous dynamic default
        wasFollowingDefault = value === dynamicDefaultPreviousValue;
      }

      if (!wasFollowingDefault) {
        // Signal has a custom value, don't update even if dynamic default changes
        dynamicDefaultPreviousValue = dynamicDefaultValue;
        return;
      }

      // Signal was using default value, update to new default
      const newDefaultValue = getDefaultValue(true);
      if (newDefaultValue === value) {
        dynamicDefaultPreviousValue = dynamicDefaultValue;
        return;
      }
      if (debug) {
        console.debug(
          `[stateSignal:${signalIdString}] dynamic default updated, update to ${newDefaultValue}`,
        );
      }
      dynamicDefaultPreviousValue = dynamicDefaultValue;
      facadeSignal.value = newDefaultValue;
    });
  }
  persist_in_local_storage: {
    if (!localStorageKey) {
      break persist_in_local_storage;
    }
    effect(() => {
      const value = preactSignal.value;

      if (dynamicDefaultSignal) {
        // With dynamic defaults: always persist to preserve user intent
        // even when value matches dynamic defaults that may change
        if (value !== undefined) {
          if (debug) {
            console.debug(
              `[stateSignal:${signalIdString}] dynamic default: writing to localStorage "${localStorageKey}"=${value}`,
            );
          }
          writeIntoLocalStorage(value);
        }
        return;
      }
      // Static defaults: only persist custom values
      if (isCustomValue(value)) {
        if (debug) {
          console.debug(
            `[stateSignal:${signalIdString}] writing into localStorage "${localStorageKey}"=${value}`,
          );
        }
        writeIntoLocalStorage(value);
      } else {
        if (debug) {
          console.debug(
            `[stateSignal:${signalIdString}] removing "${localStorageKey}" from localStorage (value=${value})`,
          );
        }
        removeFromLocalStorage();
      }
    });
  }
  // update validity object according to the signal value
  validation: {
    effect(() => {
      const value = preactSignal.value;
      facadeSignal.value = processValue(value);
    });
  }

  // Create isDefaultValue function for this signal
  const isDefaultValue = (value) => {
    const currentDefault = getDefaultValue(false);
    return value === currentDefault;
  };

  // Store signal with its options (used by route_pattern.js)
  globalSignalRegistry.set(signalIdString, {
    signal: facadeSignal,
    options: {
      staticDefaultValue,
      getDefaultValue,
      dynamicDefaultSignal,
      isCustomValue,
      isDefaultValue,
      type,
      step,
      min,
      max,
      persists,
      localStorageKey,
      debug,
      ...options,
    },
  });
  if (debug) {
    console.debug(
      `[stateSignal:${signalIdString}] created with initial value=${facadeSignal.value}`,
      {
        staticDefaultValue,
        hasDynamicDefault: Boolean(dynamicDefaultSignal),
        hasStoredValue: persists && readFromLocalStorage() !== undefined,
        persists,
        localStorageKey: persists ? localStorageKey : undefined,
      },
    );
  }

  return facadeSignal;
};

const localStorageTypeMap = {
  float: "number",
  integer: "number",
  ratio: "number",
  longitude: "number",
  latitude: "number",
  percentage: "string",
  url: "string",
  date: "string",
  time: "string",
  email: "string",
  array: "object",
};
