/**
 * Creates a validation system with configurable rules for data validation and auto-fixing.
 *
 * @param {Object} ruleConfig - Configuration object defining validation rules
 * @param {string} [ruleConfig.type] - Expected data type ('number', 'string', 'boolean', 'percentage', 'object')
 * @param {number} [ruleConfig.min] - Minimum value (for numbers)
 * @param {number} [ruleConfig.max] - Maximum value (for numbers)
 * @param {number} [ruleConfig.step] - Step increment for numbers (e.g., 0.1 for one decimal place, 1 for integers)
 * @param {Array} [ruleConfig.oneOf] - Array of allowed values (enumeration validation)
 *
 * @returns {[Object, Function]} Tuple containing:
 *   - validity: Reactive validity object with current validation state
 *   - applyOn: Function to validate values and update validity state
 *
 * @description
 * The returned validity object contains:
 * - `valid` {boolean}: Overall validation status
 * - `validSuggestion` {Object|null}: Auto-fix suggestion with `{value}` property
 * - `type` {string|undefined}: Type validation error message or undefined if valid
 * - `min` {string|undefined}: Minimum validation error message or undefined if valid
 * - `max` {string|undefined}: Maximum validation error message or undefined if valid
 * - `step` {string|undefined}: Step validation error message or undefined if valid
 * - `oneOf` {string|undefined}: Enumeration validation error message or undefined if valid
 *
 * The returned applyOn function:
 * - Takes a value to validate
 * - Updates the validity object with current validation state
 * - Provides auto-fix suggestions when possible
 * - Returns the original input value
 *
 * @example
 * // Number validation with range and step constraints
 * const [validity, applyOn] = createValidity({
 *   type: 'number',
 *   min: 0,
 *   max: 100,
 *   step: 0.5
 * });
 *
 * applyOn(1.23); // Invalid step
 * console.log(validity.valid); // false
 * console.log(validity.step); // "must be a multiple of 0.5"
 * console.log(validity.validSuggestion); // { value: 1 }
 *
 * @example
 * // Type validation with auto-conversion
 * const [validity, applyOn] = createValidity({ type: 'number' });
 *
 * applyOn('123');
 * console.log(validity.valid); // false
 * console.log(validity.validSuggestion); // { value: 123 }
 *
 * @example
 * // Enumeration validation
 * const [validity, applyOn] = createValidity({
 *   oneOf: ['red', 'green', 'blue']
 * });
 *
 * applyOn('yellow');
 * console.log(validity.oneOf); // "must be one of: red, green, blue"
 * console.log(validity.validSuggestion); // { value: 'red' }
 *
 * @throws {Error} When ruleConfig contains invalid rule values:
 * - type must be a string
 * - min must be less than or equal to max
 * - step must be a positive number
 * - oneOf must be a non-empty array
 */
export const createValidity = (ruleConfig) => {
  const validity = {};

  const ruleSet = new Set();
  setup: {
    const { type, ...rest } = ruleConfig;
    const typeDefaults = type ? TYPE_DEFAULTS[type] || {} : {};
    const effectiveRuleConfig = {
      ...typeDefaults,
      ...rest,
    };
    const { min, max, step, oneOf, ...unknown } = effectiveRuleConfig;
    if (Object.keys(unknown).length > 0) {
      console.warn(
        "[createValidity] Unknown ruleConfig properties:",
        Object.keys(unknown),
      );
    }
    if (type !== undefined) {
      validity.type = undefined;
      if (typeof type !== "string") {
        throw new Error(`[createValidity] type must be a string`);
      }
      ruleSet.add({
        key: "type",
        rule: TYPE_RULE,
        ruleValue: type,
      });
    }
    if (min !== undefined) {
      validity.min = undefined;
      if (max !== undefined && min > max) {
        throw new Error(
          `[createValidity] min (${min}) is greater than max (${max})`,
        );
      }
      ruleSet.add({
        key: "min",
        rule: MIN_RULE,
        ruleValue: min,
      });
    }
    if (max !== undefined) {
      validity.max = undefined;
      if (min !== undefined && max < min) {
        throw new Error(
          `[createValidity] max (${max}) is less than min (${min})`,
        );
      }
      ruleSet.add({
        key: "max",
        rule: MAX_RULE,
        ruleValue: max,
      });
    }
    if (step !== undefined) {
      validity.step = undefined;
      if (typeof step !== "number" || step <= 0) {
        throw new Error(`[createValidity] step must be a positive number`);
      }
      ruleSet.add({
        key: "step",
        rule: STEP_RULE,
        ruleValue: step,
      });
    }
    if (oneOf !== undefined) {
      validity.oneOf = undefined;
      if (!Array.isArray(oneOf) || oneOf.length === 0) {
        throw new Error(`[createValidity] oneOf must be a non-empty array`);
      }
      ruleSet.add({
        key: "oneOf",
        rule: ONE_OF_RULE,
        ruleValue: oneOf,
      });
    }
    validity.valid = true;
    validity.validSuggestion = null;
  }

  const applyOn = (value) => {
    let valid = true;
    let validSuggestion = null;

    for (const { key, rule, ruleValue } of ruleSet) {
      const result = rule.applyOn(ruleValue, value, ruleConfig);
      if (!result) {
        // valid
        validity[key] = undefined;
        continue;
      }
      const { message, autoFix } = result;
      valid = false;
      validity[key] = message;
      if (!autoFix) {
        continue;
      }
      if (validSuggestion) {
        // Don't try to create a new suggestion if we already have a valid one
        continue;
      }
      const autoFixResult = autoFix();
      if (autoFixResult === CANNOT_AUTOFIX) {
        // invalid and cannot autofix
        continue;
      }
      // Test the potential suggestion against ALL rules before accepting it
      let suggestionIsValid = true;
      for (const { rule, ruleValue } of ruleSet) {
        const result = rule.applyOn(ruleValue, autoFixResult, ruleConfig);
        if (!result) {
          continue;
        }
        suggestionIsValid = false;
        break;
      }
      if (suggestionIsValid) {
        validSuggestion = {
          value: autoFixResult,
        };
      }
    }

    validity.valid = valid;
    validity.validSuggestion = validSuggestion;
    return value;
  };

  return [validity, applyOn];
};

const CANNOT_AUTOFIX = {};

const TYPE_DEFAULTS = {
  ratio: { min: 0, max: 1 },
  longitude: { min: -180, max: 180 },
  latitude: { min: -90, max: 90 },
};

const TYPE_RULE = {
  id: "type",
  applyOn: (type, value) => {
    const actualType = typeof value;
    let message;
    const validator = TYPE_VALIDATORS[type];
    if (validator) {
      message = validator(value);
    } else if (actualType !== type) {
      message = `must be a ${type}, got ${actualType}`;
    }
    if (!message) {
      return null;
    }
    const typeConverter = TYPE_CONVERTERS[type];
    const convertValue = typeConverter ? typeConverter[actualType] : null;
    return {
      message,
      autoFix: convertValue ? () => convertValue(value) : null,
    };
  },
};
const TYPE_VALIDATORS = {
  number: (value) => {
    if (typeof value !== "number") {
      return `must be a number`;
    }
    if (!Number.isFinite(value)) {
      return `must be finite`;
    }
    return "";
  },
  float: (value) => TYPE_VALIDATORS.number(value),
  integer: (value) => {
    const numberError = TYPE_VALIDATORS.number(value);
    if (numberError) {
      return numberError;
    }
    if (!Number.isInteger(value)) {
      return `must be an integer`;
    }
    return "";
  },
  ratio: (value) => TYPE_VALIDATORS.number(value),
  longitude: (value) => TYPE_VALIDATORS.number(value),
  latitude: (value) => TYPE_VALIDATORS.number(value),
  percentage: (value) => {
    if (typeof value !== "string") {
      return `must be a percentage`;
    }
    if (!value.endsWith("%")) {
      return `must end with %`;
    }
    const percentageString = value.slice(0, -1);
    const percentageFloat = parseFloat(percentageString);
    if (typeof percentageFloat !== "number") {
      return `must be a percentage`;
    }
    if (percentageFloat < 0 || percentageFloat > 100) {
      return `must be between 0 and 100`;
    }
    return "";
  },
  email: (value) => {
    if (typeof value !== "string") {
      return `must be a string`;
    }
    const emailregex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!value.includes("@")) {
      return `must be a valid email address`;
    }
    if (!emailregex.test(value)) {
      return `must be a valid email address`;
    }
    return "";
  },
  url: (value) => {
    if (typeof value !== "string") {
      return `must be a string`;
    }
    try {
      // eslint-disable-next-line no-new
      new URL(value);
      return "";
    } catch {
      return `must be a valid URL`;
    }
  },
  date: (value) => {
    if (typeof value !== "string") {
      return `must be a string`;
    }
    const dateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = dateRegex.exec(value);
    if (!match) {
      return `must be in YYYY-MM-DD format`;
    }

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    // Create date and verify it matches input (catches invalid dates like Feb 30)
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return `must be a valid date`;
    }

    return "";
  },
  time: (value) => {
    if (typeof value !== "string") {
      return `must be a string`;
    }
    const timeRegex = /^(?:[01]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/;
    if (!timeRegex.test(value)) {
      return `must be in HH:MM or HH:MM:SS format`;
    }
    return "";
  },
};

const wellKnownColorSet = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "cyan",
  "magenta",
  "silver",
  "gray",
  "maroon",
  "olive",
  "lime",
  "aqua",
  "teal",
  "navy",
  "fuchsia",
  "purple",
  "orange",
  "pink",
  "brown",
  "gold",
  "violet",
]);
TYPE_VALIDATORS.color = (value) => {
  if (typeof value !== "string") {
    return `must be a string`;
  }
  const hexRegex = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
  const rgbRegex =
    /^rgb\(\s*(?:[01]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])\s*,\s*(?:[01]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])\s*,\s*(?:[01]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])\s*\)$/;
  const rgbaRegex =
    /^rgba\(\s*(?:[01]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])\s*,\s*(?:[01]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])\s*,\s*(?:[01]?[0-9]{1,2}|2[0-4][0-9]|25[0-5])\s*,\s*(?:[01]|0?\.[0-9]+)\s*\)$/;

  if (
    hexRegex.test(value) ||
    rgbRegex.test(value) ||
    rgbaRegex.test(value) ||
    wellKnownColorSet.has(value.toLowerCase())
  ) {
    return "";
  }
  return `must be a valid color (hex, rgb, rgba, or named color)`;
};

const TYPE_CONVERTERS = {
  boolean: {
    string: (value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      if (value === "on") return true;
      if (value === "off") return false;
      if (value === "1") return true;
      if (value === "0") return false;
      return CANNOT_AUTOFIX;
    },
    number: (value) => {
      if (value === 0) return false;
      if (value === 1) return true;
      return CANNOT_AUTOFIX;
    },
  },
  string: {
    number: String,
    boolean: String,
  },
  number: {
    string: (value) => {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && isFinite(parsed)) {
        return parsed;
      }
      return CANNOT_AUTOFIX;
    },
  },
  float: {
    string: (value) => TYPE_CONVERTERS.number.string(value),
  },
  integer: {
    string: (value) => {
      const result = TYPE_CONVERTERS.number.string(value);
      if (result === CANNOT_AUTOFIX) {
        return CANNOT_AUTOFIX;
      }
      return Math.round(result);
    },
    number: (value) => {
      return Math.round(value);
    },
  },
  ratio: {
    string: (value) => TYPE_CONVERTERS.number.string(value),
  },
  longitude: {
    string: (value) => TYPE_CONVERTERS.number.string(value),
  },
  latitude: {
    string: (value) => TYPE_CONVERTERS.number.string(value),
  },
  percentage: {
    number: (value) => {
      if (value >= 0 && value <= 100) {
        return `${value}%`;
      }
      return CANNOT_AUTOFIX;
    },
    string: (value) => {
      if (value.endsWith("%")) {
        return value;
      }
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        return `${parsed}%`;
      }
      return CANNOT_AUTOFIX;
    },
  },
  object: {
    string: (value) => {
      try {
        return JSON.parse(value);
      } catch {
        // Invalid JSON, can't convert
        return CANNOT_AUTOFIX;
      }
    },
  },
};

const MIN_RULE = {
  id: "min",
  applyOn: (min, value) => {
    if (min === undefined) {
      return null;
    }
    if (typeof value !== "number") {
      return null;
    }
    if (value >= min) {
      return null;
    }
    return {
      message: min === 0 ? `must be positive` : `must be >= ${min}`,
      autoFix: () => min,
    };
  },
};
const MAX_RULE = {
  id: "max",
  applyOn: (max, value) => {
    if (max === undefined) {
      return null;
    }
    if (typeof value !== "number") {
      return null;
    }
    if (value <= max) {
      return null;
    }
    return {
      message: max === 0 ? `must be negative` : `must be <= ${max}`,
      autoFix: () => max,
    };
  },
};
const STEP_RULE = {
  id: "step",
  applyOn: (step, value, { min = 0 }) => {
    if (step === undefined) {
      return null;
    }
    if (typeof value !== "number") {
      return null;
    }
    const remainer = (value - min) % step;
    const epsilon = 0.0000001;
    if (remainer <= epsilon || step - remainer <= epsilon) {
      return null;
    }
    return {
      message:
        step === 1 ? `must be an integer` : `must be a multiple of ${step}`,
      autoFix: () => {
        const fixedValue = Math.round(value / step) * step;
        // Fix floating point precision issues
        const stepStr = step.toString();
        const decimalPlaces = stepStr.includes(".")
          ? stepStr.split(".")[1].length
          : 0;
        const roundedValue = Number(fixedValue.toFixed(decimalPlaces));
        return roundedValue;
      },
    };
  },
};
const ONE_OF_RULE = {
  id: "oneOf",
  applyOn: (oneOf, value) => {
    if (!Array.isArray(oneOf)) {
      return null;
    }
    if (oneOf.includes(value)) {
      return null;
    }
    return {
      message: `must be one of: ${oneOf.join(", ")}`,
      autoFix: () => oneOf[0],
    };
  },
};
