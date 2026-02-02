export const createValidity = (ruleConfig) => {
  const validity = {
    valid: true,
    validValueSuggestion: null,
  };

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

  const applyOn = (value) => {
    let valid = true;
    let validValueSuggestion = null;
    for (const { key, rule, ruleValue } of ruleSet) {
      if (validValueSuggestion) {
        const suggestionResult = rule.applyOn(
          ruleValue,
          validValueSuggestion.value,
          ruleConfig,
        );
        if (suggestionResult) {
          const { autoFix } = suggestionResult;
          if (autoFix) {
            const autoFixResult = autoFix();
            if (autoFixResult && autoFixResult.type === "valid_value") {
              validValueSuggestion = {
                value: autoFixResult.data,
              };
            }
          } else {
            validValueSuggestion = null;
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
            validValueSuggestion = {
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
    validity.validValueSuggestion = validValueSuggestion;
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
        return Math.round(value / step) * step;
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
