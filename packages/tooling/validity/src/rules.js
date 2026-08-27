import { message } from "./message.js";
import { TYPES } from "./types.js";

export const TYPE_RULE = {
  id: "type",
  applyOn: (type, value) => {
    const actualType = typeof value;
    const typeDef = TYPES[type];
    if (typeDef?.validate) {
      return typeDef.validate(value) || null;
    }
    if (actualType === type) {
      return null;
    }
    return message("type.mismatch", { type, actualType });
  },
};
export const MIN_RULE = {
  id: "min",
  applyOn: (min, value, ruleConfig) => {
    if (min === undefined) {
      return null;
    }
    const type = ruleConfig.type;
    if (
      type === "date" ||
      type === "month" ||
      type === "datetime" ||
      type === "time"
    ) {
      const valueMs = toMs(value, type);
      const minMs = toMs(min, type);
      if (valueMs === null || minMs === null) {
        return null;
      }
      if (valueMs >= minMs) {
        return null;
      }
      return {
        ...message("min.temporal", { min: formatTemporalBound(min, type) }),
        autoFix: () => fromMs(minMs, value, type),
      };
    }
    const typeDef = type ? TYPES[type] : null;
    if (typeDef?.toComparable) {
      const comparable = typeDef.toComparable(value);
      if (comparable === null || comparable === undefined) {
        return null;
      }
      if (comparable >= min) {
        return null;
      }
      return message("min.default", { min });
    }
    if (typeof value !== "number") {
      return null;
    }
    if (value >= min) {
      return null;
    }
    return {
      ...(min === 0
        ? message("min.positive")
        : message("min.default", { min })),
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
    if (
      type === "date" ||
      type === "month" ||
      type === "datetime" ||
      type === "time"
    ) {
      const valueMs = toMs(value, type);
      const maxMs = toMs(max, type);
      if (valueMs === null || maxMs === null) {
        return null;
      }
      if (valueMs <= maxMs) {
        return null;
      }
      return {
        ...message("max.temporal", { max: formatTemporalBound(max, type) }),
        autoFix: () => fromMs(maxMs, value, type),
      };
    }
    const typeDef = type ? TYPES[type] : null;
    if (typeDef?.toComparable) {
      const comparable = typeDef.toComparable(value);
      if (comparable === null || comparable === undefined) {
        return null;
      }
      if (comparable <= max) {
        return null;
      }
      return message("max.default", { max });
    }
    if (typeof value !== "number") {
      return null;
    }
    if (value <= max) {
      return null;
    }
    return {
      ...(max === 0
        ? message("max.negative")
        : message("max.default", { max })),
      autoFix: () => max,
    };
  },
};
export const STEP_RULE = {
  id: "step",
  applyOn: (step, value, { min = 0, type }) => {
    if (step === undefined) {
      return null;
    }
    if (type === "time") {
      if (typeof value !== "string") {
        return null;
      }
      const valueSeconds = timeStringToSeconds(value);
      const minSeconds =
        typeof min === "string"
          ? timeStringToSeconds(min)
          : typeof min === "number"
            ? min
            : 0;
      if (valueSeconds === null || minSeconds === null) {
        return null;
      }
      const stepSeconds =
        typeof step === "number" ? step : timeStringToSeconds(step);
      if (stepSeconds === null || stepSeconds <= 0) {
        return null;
      }
      const remainder =
        (((valueSeconds - minSeconds) % stepSeconds) + stepSeconds) %
        stepSeconds;
      if (remainder === 0) {
        return null;
      }
      const beforeSeconds = valueSeconds - remainder;
      const afterSeconds = beforeSeconds + stepSeconds;
      const before = secondsToTimeString(beforeSeconds);
      const after = secondsToTimeString(afterSeconds);
      return {
        ...message("step.time", {
          step: stepSeconds,
          min: typeof min === "string" ? min : secondsToTimeString(minSeconds),
          before,
          after,
        }),
        autoFix: () => {
          const rounded =
            minSeconds +
            Math.round((valueSeconds - minSeconds) / stepSeconds) * stepSeconds;
          return secondsToTimeString(rounded);
        },
      };
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

    const stepMessage = (() => {
      if (hasTooMuchPrecision && !isMultipleOfStep) {
        return message("step.multiple_and_precision", {
          step,
          decimals: maxAllowedDecimals,
        });
      }
      if (hasTooMuchPrecision) {
        return message("step.precision", { decimals: maxAllowedDecimals });
      }
      if (step === 1) {
        return message("step.integer");
      }
      return message("step.multiple", { step });
    })();

    return {
      ...stepMessage,
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
    return {
      ...message("one_of.default", {
        values: oneOf.map((v) => JSON.stringify(v)).join(", "),
      }),
      autoFix: () => oneOf[0],
    };
  },
};

// Converts a temporal value (string YYYY-MM-DD, YYYY-MM, timestamp, or Date) to ms
const toMs = (value, type) => {
  if (type === "time") {
    const seconds =
      typeof value === "string"
        ? timeStringToSeconds(value)
        : typeof value === "number"
          ? value
          : null;
    return seconds !== null ? seconds * 1000 : null;
  }
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
  if (type === "time") {
    return secondsToTimeString(Math.round(ms / 1000));
  }
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
  if (type === "time") {
    return typeof value === "string" ? value : secondsToTimeString(value);
  }
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

const timeStringToSeconds = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    return null;
  }
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const s = match[3] ? parseInt(match[3], 10) : 0;
  return h * 3600 + m * 60 + s;
};

const secondsToTimeString = (totalSeconds) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  if (s === 0) {
    return `${hh}:${mm}`;
  }
  const ss = String(s).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};
