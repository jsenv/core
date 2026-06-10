import { TYPES } from "./types.js";

export const TYPE_RULE = {
  id: "type",
  applyOn: (type, value) => {
    const actualType = typeof value;
    let message;
    const typeDef = TYPES[type];
    if (typeDef?.validate) {
      message = typeDef.validate(value);
    } else if (actualType !== type) {
      message = `must be a ${type}, got ${actualType}`;
    }
    if (!message) {
      return null;
    }
    return { message };
  },
};
export const MIN_RULE = {
  id: "min",
  applyOn: (min, value, ruleConfig) => {
    if (min === undefined) {
      return null;
    }
    const type = ruleConfig.type;
    if (type === "date" || type === "month" || type === "datetime") {
      const valueMs = toMs(value, type);
      const minMs = toMs(min, type);
      if (valueMs === null || minMs === null) {
        return null;
      }
      if (valueMs >= minMs) {
        return null;
      }
      const minLabel = formatTemporalBound(min, type);
      return {
        message: `must be on or after ${minLabel}`,
        autoFix: () => fromMs(minMs, value, type),
      };
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
export const MAX_RULE = {
  id: "max",
  applyOn: (max, value, ruleConfig) => {
    if (max === undefined) {
      return null;
    }
    const type = ruleConfig.type;
    if (type === "date" || type === "month" || type === "datetime") {
      const valueMs = toMs(value, type);
      const maxMs = toMs(max, type);
      if (valueMs === null || maxMs === null) {
        return null;
      }
      if (valueMs <= maxMs) {
        return null;
      }
      const maxLabel = formatTemporalBound(max, type);
      return {
        message: `must be on or before ${maxLabel}`,
        autoFix: () => fromMs(maxMs, value, type),
      };
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
export const STEP_RULE = {
  id: "step",
  applyOn: (step, value, { min = 0 }) => {
    if (step === undefined) {
      return null;
    }
    if (typeof value !== "number") {
      return null;
    }

    // Get the number of decimal places in the step to determine allowed precision
    const getDecimalPlaces = (num) => {
      const str = num.toString();
      return str.includes(".") ? str.split(".")[1].length : 0;
    };

    const stepDecimals = getDecimalPlaces(step);
    const minDecimals = getDecimalPlaces(min);
    const maxAllowedDecimals = Math.max(stepDecimals, minDecimals);

    // Check precision first - round to step's precision
    const roundedToPrecision = Number(value.toFixed(maxAllowedDecimals));

    // Check if it's a multiple of the step
    const adjustedValue = roundedToPrecision - min;
    const ratio = adjustedValue / step;
    const remainder = Math.abs(ratio - Math.round(ratio));
    const epsilon = 1e-10; // Very small epsilon for floating point comparison

    const isMultipleOfStep = remainder < epsilon;
    const hasTooMuchPrecision = value !== roundedToPrecision;

    if (isMultipleOfStep && !hasTooMuchPrecision) {
      return null; // Valid
    }

    // Determine the error message
    let message;
    if (hasTooMuchPrecision && !isMultipleOfStep) {
      message = `must be a multiple of ${step} with at most ${maxAllowedDecimals} decimal places`;
    } else if (hasTooMuchPrecision) {
      message = `must have at most ${maxAllowedDecimals} decimal places`;
    } else {
      message =
        step === 1 ? `must be an integer` : `must be a multiple of ${step}`;
    }

    return {
      message,
      autoFix: () => {
        // First round to proper precision, then ensure it's a multiple of step
        const precisionFixed = Number(value.toFixed(maxAllowedDecimals));
        const adjustedValue = precisionFixed - min;
        const ratio = adjustedValue / step;

        // Round to nearest step multiple
        const fractionalPart = ratio - Math.floor(ratio);
        let roundedRatio;
        if (Math.abs(fractionalPart - 0.5) < 1e-10) {
          // Exactly halfway - round down
          roundedRatio = Math.floor(ratio);
        } else {
          roundedRatio = Math.round(ratio);
        }

        const fixedValue = min + roundedRatio * step;
        return Number(fixedValue.toFixed(maxAllowedDecimals));
      },
    };
  },
};
export const ONE_OF_RULE = {
  id: "oneOf",
  applyOn: (oneOf, value) => {
    if (!Array.isArray(oneOf)) {
      return null;
    }
    if (oneOf.includes(value)) {
      return null;
    }
    const oneOfSource = oneOf.map((v) => JSON.stringify(v)).join(", ");
    return {
      message: `must be one of: ${oneOfSource}`,
      autoFix: () => oneOf[0],
    };
  },
};

// Converts a temporal value (string YYYY-MM-DD, YYYY-MM, timestamp, or Date) to ms
const toMs = (value, type) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (type === "date") {
      // Normalize to start of local day
      const d = new Date(value);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }
    if (type === "month") {
      const d = new Date(value);
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    }
    return value;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value === "string") {
    if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const d = new Date(`${value}T00:00:00`);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
    if (type === "month" && /^\d{4}-\d{2}$/.test(value)) {
      const d = new Date(`${value}-01T00:00:00`);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
    if (type === "datetime") {
      const d = new Date(value);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
  }
  return null;
};
// Converts a ms timestamp back to the same format as the original value
const fromMs = (ms, originalValue, type) => {
  const d = new Date(ms);
  if (typeof originalValue === "number") {
    return ms;
  }
  if (originalValue instanceof Date) {
    return d;
  }
  // string
  if (type === "date") {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (type === "month") {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  }
  return d.toISOString();
};
const formatTemporalBound = (value, type) => {
  if (typeof value === "number") {
    const d = new Date(value);
    if (type === "date") {
      return d.toLocaleDateString();
    }
    if (type === "month") {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    return d.toLocaleString();
  }
  return String(value);
};
