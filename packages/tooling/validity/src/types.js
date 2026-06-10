export const CANNOT_AUTOFIX = {};

// Parses a time string "HH:MM" or "H:MM" into { left, right }.
// Returns null if the string is not a time string.
const parseTimeString = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const match = /^(\d+):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return { left: parseInt(match[1], 10), right: parseInt(match[2], 10) };
};
const resolveTimeStringAsMinutes = (value) => {
  const parsed = parseTimeString(value);
  if (!parsed) {
    return value;
  }
  return parsed.left * 60 + parsed.right;
};
const resolveTimeStringAsHours = (value) => {
  const parsed = parseTimeString(value);
  if (!parsed) {
    return value;
  }
  return parsed.left + parsed.right / 60;
};
const resolveTimeStringAsSeconds = (value) => {
  const parsed = parseTimeString(value);
  if (!parsed) {
    return value;
  }
  return parsed.left * 60 + parsed.right;
};

const validateNumber = (value) => {
  if (typeof value !== "number") {
    return `must be a number`;
  }
  if (!Number.isFinite(value)) {
    return `must be finite`;
  }
  return "";
};
const convertStringToNumber = (value) => {
  const parsed = parseFloat(value);
  if (!isNaN(parsed) && isFinite(parsed)) {
    return parsed;
  }
  return CANNOT_AUTOFIX;
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

export const TYPES = {
  number: {
    validate: validateNumber,
    convert: {
      string: convertStringToNumber,
    },
  },
  float: {
    validate: validateNumber,
    convert: {
      string: convertStringToNumber,
    },
  },
  integer: {
    validate: (value) => {
      const numberError = validateNumber(value);
      if (numberError) {
        return numberError;
      }
      if (!Number.isInteger(value)) {
        return `must be an integer`;
      }
      return "";
    },
    convert: {
      string: (value) => {
        const result = convertStringToNumber(value);
        if (result === CANNOT_AUTOFIX) {
          return CANNOT_AUTOFIX;
        }
        return Math.round(result);
      },
      number: (value) => Math.round(value),
    },
  },
  boolean: {
    convert: {
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
  },
  string: {
    convert: {
      number: String,
      boolean: String,
    },
  },
  ratio: {
    props: {
      min: { default: 0 },
      max: { default: 1 },
    },
    validate: validateNumber,
    convert: {
      string: convertStringToNumber,
    },
  },
  longitude: {
    props: {
      min: { default: -180 },
      max: { default: 180 },
    },
    validate: validateNumber,
    convert: {
      string: convertStringToNumber,
    },
  },
  latitude: {
    props: {
      min: { default: -90 },
      max: { default: 90 },
    },
    validate: validateNumber,
    convert: {
      string: convertStringToNumber,
    },
  },
  hour: {
    props: {
      min: { default: 0, resolver: resolveTimeStringAsHours },
      max: { default: 24, resolver: resolveTimeStringAsHours },
      step: { default: 1, resolver: resolveTimeStringAsHours },
    },
    validate: (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return "";
      }
      return `must be a number`;
    },
    convert: {
      string: convertStringToNumber,
    },
  },
  minute: {
    props: {
      min: { default: 0, resolver: resolveTimeStringAsMinutes },
      max: { default: 60, resolver: resolveTimeStringAsMinutes },
      step: { default: 1, resolver: resolveTimeStringAsMinutes },
    },
    validate: (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return "";
      }
      return `must be a number`;
    },
    convert: {
      string: convertStringToNumber,
    },
  },
  second: {
    props: {
      min: { default: 0, resolver: resolveTimeStringAsSeconds },
      max: { default: 60, resolver: resolveTimeStringAsSeconds },
      step: { default: 1, resolver: resolveTimeStringAsSeconds },
    },
    validate: (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return "";
      }
      return `must be a number`;
    },
    convert: {
      string: convertStringToNumber,
    },
  },
  percentage: {
    validate: (value) => {
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
    convert: {
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
  },
  email: {
    validate: (value) => {
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
  },
  url: {
    validate: (value) => {
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
  },
  color: {
    validate: (value) => {
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
    },
  },
  array: {
    validate: (value) => {
      if (!Array.isArray(value)) {
        return `must be an array, got ${typeof value}`;
      }
      return "";
    },
    convert: {
      string: (value) => {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            return CANNOT_AUTOFIX;
          }
          return parsed;
        } catch {
          return CANNOT_AUTOFIX;
        }
      },
    },
  },
  object: {
    validate: (value) => {
      if (Array.isArray(value)) {
        return `must be an object, got array`;
      }
      if (typeof value !== "object" || value === null) {
        return `must be an object, got ${typeof value}`;
      }
      return "";
    },
    convert: {
      string: (value) => {
        try {
          const parsed = JSON.parse(value);
          if (
            Array.isArray(parsed) ||
            typeof parsed !== "object" ||
            parsed === null
          ) {
            return CANNOT_AUTOFIX;
          }
          return parsed;
        } catch {
          return CANNOT_AUTOFIX;
        }
      },
    },
  },
  date: {
    validate: (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return ""; // timestamp
      }
      if (typeof value !== "string") {
        return `must be a string in YYYY-MM-DD format or a timestamp`;
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
  },
  time: {
    validate: (value) => {
      if (typeof value !== "string") {
        return `must be a string`;
      }
      const timeRegex = /^(?:[01]?[0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/;
      if (!timeRegex.test(value)) {
        return `must be in HH:MM or HH:MM:SS format`;
      }
      return "";
    },
  },
  month: {
    validate: (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return ""; // timestamp
      }
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? `must be a valid date` : "";
      }
      if (typeof value !== "string") {
        return `must be a string in YYYY-MM format or a timestamp`;
      }
      const monthRegex = /^\d{4}-\d{2}$/;
      const match = monthRegex.exec(value);
      if (!match) {
        return `must be in YYYY-MM format`;
      }
      const month = parseInt(match[0].slice(5), 10);
      if (month < 1 || month > 12) {
        return `must be a valid month (01–12)`;
      }
      return "";
    },
  },
  datetime: {
    validate: (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return ""; // timestamp
      }
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? `must be a valid datetime` : "";
      }
      if (typeof value !== "string") {
        return `must be a string or a timestamp`;
      }
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        return `must be a valid datetime`;
      }
      return "";
    },
  },
};
