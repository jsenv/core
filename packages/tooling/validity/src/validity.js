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

  const { type, min, max, step, oneOf, ...rest } = ruleConfig;
  if (Object.keys(rest).length > 0) {
    console.warn(
      "[createValidity] Unknown ruleConfig properties:",
      Object.keys(rest),
    );
  }
  const ruleSet = new Set();

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

  const applyOn = (value) => {
    let valid = true;
    let validSuggestion = null;
    for (const { key, rule, ruleValue } of ruleSet) {
      if (validSuggestion) {
        const suggestionResult = rule.applyOn(
          ruleValue,
          validSuggestion.value,
          ruleConfig,
        );
        if (suggestionResult) {
          const { autoFix } = suggestionResult;
          if (autoFix) {
            const autoFixResult = autoFix();
            if (autoFixResult && autoFixResult.type === "valid_value") {
              validSuggestion = {
                value: autoFixResult.data,
              };
            }
          } else {
            validSuggestion = null;
          }
        }
      }

      const result = rule.applyOn(ruleValue, value, ruleConfig);
      if (result) {
        const { message, autoFix } = result;
        valid = false;
        validity[key] = message;
        if (autoFix) {
          const autoFixResult = autoFix();
          if (autoFixResult && autoFixResult.type === "valid_value") {
            validSuggestion = {
              value: autoFixResult.data,
            };
          }
        }
        continue;
      }
      validity[key] = undefined;
      continue;
    }
    validity.valid = valid;
    validity.validSuggestion = validSuggestion;
    return value;
  };

  return [validity, applyOn];
};

const createValidValue = (value) => {
  return {
    type: "valid_value",
    data: value,
  };
};

const TYPE_RULE = {
  id: "type",
  applyOn: (type, value) => {
    const actualType = typeof value;
    if (actualType === type) {
      return null;
    }
    const validator = TYPE_VALIDATORS[type];
    const message = validator
      ? validator(value)
      : `must be a ${type}, got ${actualType}`;
    const typeConverter = TYPE_CONVERTERS[type];
    const convertValue = typeConverter ? typeConverter[actualType] : null;
    return {
      message,
      autoFix: convertValue
        ? () => {
            const convertedValue = convertValue(value);
            return createValidValue(convertedValue);
          }
        : null,
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
};
const TYPE_CONVERTERS = {
  boolean: {
    string: (value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    },
    number: (value) => {
      return Boolean(value);
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
      return value;
    },
  },
  percentage: {
    number: (value) => {
      if (value >= 0 && value <= 100) {
        return `${value}%`;
      }
      return value;
    },
    string: (value) => {
      if (value.endsWith("%")) {
        return value;
      }
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        return `${parsed}%`;
      }
      return value;
    },
  },
  object: {
    string: (value) => {
      try {
        return JSON.parse(value);
      } catch {
        // Invalid JSON, can't convert
        return value;
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
      autoFix: () => createValidValue(min),
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
      autoFix: () => createValidValue(max),
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
        return createValidValue(roundedValue);
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
      autoFix: () => createValidValue(oneOf[0]),
    };
  },
};
