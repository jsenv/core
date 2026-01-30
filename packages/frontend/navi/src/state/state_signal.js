import { effect, signal } from "@preact/signals";

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
 *
 * This is useful for:
 * - Backend data that can change but shouldn't override user preferences
 * - Route parameters with dynamic defaults based on other state
 * - Cascading configuration where defaults can be updated without losing user customizations
 *
 * @param {any|import("@preact/signals").Signal} defaultValue - Static default value OR signal for dynamic default behavior
 * @param {Object} [options={}] - Configuration options
 * @param {string|number} [options.id] - Custom ID for the signal. If not provided, an auto-generated ID will be used. Used for localStorage key and route pattern detection.
 * @param {boolean} [options.persists=false] - Whether to persist the signal value in localStorage using the signal ID as key
 * @param {"string" | "number" | "boolean" | "object"} [options.type="string"] - Type for localStorage serialization/deserialization
 * @param {Array} [options.oneOf] - Array of valid values for validation. Signal will be marked invalid if value is not in this array
 * @param {Function} [options.autoFix] - Function to call when validation fails to automatically fix the value
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
 * // Route parameter with dynamic default from parent route
 * const parentTab = signal("overview");
 * const childTab = stateSignal(parentTab);
 * // childTab follows parentTab changes unless explicitly set
 */
const NO_LOCAL_STORAGE = [() => undefined, () => {}, () => {}];
export const stateSignal = (defaultValue, options = {}) => {
  const {
    id,
    type = "string",
    oneOf,
    autoFix,
    persists = false,
    debug,
  } = options;

  // Check if defaultValue is a signal (dynamic default) or static value
  const isDynamicDefault =
    defaultValue &&
    typeof defaultValue === "object" &&
    "value" in defaultValue &&
    "peek" in defaultValue;
  const dynamicDefaultSignal = isDynamicDefault ? defaultValue : null;
  const staticDefaultValue = isDynamicDefault ? undefined : defaultValue;
  const signalId = id || generateSignalId();
  // Convert numeric IDs to strings for consistency
  const signalIdString = String(signalId);
  if (globalSignalRegistry.has(signalIdString)) {
    const conflictInfo = globalSignalRegistry.get(signalIdString);
    throw new Error(
      `Signal ID conflict: A signal with ID "${signalIdString}" already exists (existing default: ${conflictInfo.options.defaultValue})`,
    );
  }

  // Determine localStorage key: use id if persists=true, or legacy localStorage option
  const localStorageKey = signalIdString;
  const [readFromLocalStorage, writeIntoLocalStorage, removeFromLocalStorage] =
    persists
      ? valueInLocalStorage(localStorageKey, { type })
      : NO_LOCAL_STORAGE;
  const getDefaultValue = () => {
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
    if (dynamicDefaultSignal) {
      const dynamicValue = dynamicDefaultSignal.peek();
      if (dynamicValue === undefined) {
        return undefined;
      }
      if (debug) {
        console.debug(
          `[stateSignal:${signalIdString}] using value from dynamic default signal=${dynamicValue}`,
        );
      }
      return dynamicValue;
    }
    if (debug) {
      console.debug(
        `[stateSignal:${signalIdString}] using static default value=${staticDefaultValue}`,
      );
    }
    return staticDefaultValue;
  };
  const isCustomValue = (value) => {
    if (value === undefined) {
      return false;
    }
    if (dynamicDefaultSignal) {
      return value !== dynamicDefaultSignal.peek();
    }
    return value !== staticDefaultValue;
  };

  // Create signal with initial value: use stored value, or undefined to indicate no explicit value
  const advancedSignal = signal(getDefaultValue());
  const validity = { valid: true };
  advancedSignal.validity = validity;
  advancedSignal.__signalId = signalIdString;
  advancedSignal.toString = () => `{navi_state_signal:${signalIdString}}`;
  // 1. when signal value changes to undefined, it needs to fallback to default value
  // 2. when dynamic default changes and signal value is not custom, it needs to update
  undefined_effect: {
    let isFirstRun = true;
    effect(() => {
      const value = advancedSignal.value;
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      if (value !== undefined) {
        return;
      }
      const defaultValue = getDefaultValue();
      if (defaultValue === value) {
        return;
      }
      if (debug) {
        console.debug(
          `[stateSignal:${signalIdString}] becomes undefined, reset to ${defaultValue}`,
        );
      }
      advancedSignal.value = defaultValue;
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
      const value = advancedSignal.peek();
      const dynamicDefaultValue = dynamicDefaultSignal.value;
      if (isFirstRun) {
        isFirstRun = false;
        dynamicDefaultPreviousValue = dynamicDefaultValue;
        return;
      }
      if (value !== dynamicDefaultPreviousValue) {
        dynamicDefaultPreviousValue = dynamicDefaultValue;
        return;
      }
      dynamicDefaultPreviousValue = dynamicDefaultValue;
      const defaultValue = getDefaultValue();
      if (defaultValue === value) {
        return;
      }
      if (debug) {
        console.debug(
          `[stateSignal:${signalIdString}] dynamic default updated, update to ${defaultValue}`,
        );
      }
      advancedSignal.value = defaultValue;
    });
  }
  persist_in_local_storage: {
    if (!localStorageKey) {
      break persist_in_local_storage;
    }
    effect(() => {
      const value = advancedSignal.value;
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
      const wasValid = validity.valid;
      const value = advancedSignal.value;
      updateValidity({ oneOf }, validity, value);
      if (validity.valid) {
        if (!wasValid) {
          if (debug) {
            console.debug(
              `[stateSignal:${signalIdString}] validation now passes`,
              { value },
            );
          }
        }
        return;
      }
      if (debug) {
        console.debug(`[stateSignal:${signalIdString}] validation failed`, {
          value,
          oneOf,
          hasAutoFix: Boolean(autoFix),
        });
      }
      if (autoFix) {
        const fixedValue = autoFix(value);
        if (debug) {
          console.debug(
            `[stateSignal:${signalIdString}] autoFix applied: ${value} → ${fixedValue}`,
            {
              value,
              fixedValue,
            },
          );
        }
        advancedSignal.value = fixedValue;
        return;
      }
    });
  }
  // Store signal with its options (used by route_pattern.js)
  globalSignalRegistry.set(signalIdString, {
    signal: advancedSignal,
    options: {
      getDefaultValue,
      defaultValue: staticDefaultValue,
      dynamicDefaultSignal,
      isCustomValue,
      type,
      persists,
      localStorageKey,
      debug,
      ...options,
    },
  });
  if (debug) {
    console.debug(
      `[stateSignal:${signalIdString}] created with initial value=${advancedSignal.value}`,
      {
        staticDefaultValue,
        hasDynamicDefault: Boolean(dynamicDefaultSignal),
        hasStoredValue: persists && readFromLocalStorage() !== undefined,
        persists,
        localStorageKey: persists ? localStorageKey : undefined,
      },
    );
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
