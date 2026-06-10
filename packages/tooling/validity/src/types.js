import {
  formatHours,
  formatMinutes,
  formatSeconds,
} from "./format_duration.js";

export const CANNOT_CONVERT = {};

// Parses a duration string into a total number of seconds.
// Supported notations:
//   single unit   "5s" / "5second", "10min" / "10minute"
//                 "2h" / "2hour", "3d" / "3day"
//                 "2w" / "2week", "1month", "1year"
//   compound      "1h20min" → 1h + 20min, "1h20min30s" → 1h + 20min + 30s
// Returns null when the value cannot be parsed.
export const parseDurationToSeconds = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const str = value.trim();

  // Compound: 1h20min, 1h20min30s, 2h30min, 20min30s, etc.
  const compoundMatch =
    /^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)min)?(?:(\d+(?:\.\d+)?)s)?$/.exec(
      str,
    );
  if (
    compoundMatch &&
    (compoundMatch[1] || compoundMatch[2] || compoundMatch[3]) &&
    str !== ""
  ) {
    const h = compoundMatch[1] ? parseFloat(compoundMatch[1]) : 0;
    const min = compoundMatch[2] ? parseFloat(compoundMatch[2]) : 0;
    const sec = compoundMatch[3] ? parseFloat(compoundMatch[3]) : 0;
    return h * 3600 + min * 60 + sec;
  }

  // Single value with long-form unit
  const singleMatch =
    /^(\d+(?:\.\d+)?)(second|minute|hour|day|week|month|year)s?$/.exec(str);
  if (singleMatch) {
    const n = parseFloat(singleMatch[1]);
    const unit = singleMatch[2];
    if (unit === "second") {
      return n;
    }
    if (unit === "minute") {
      return n * 60;
    }
    if (unit === "hour") {
      return n * 3600;
    }
    if (unit === "day") {
      return n * 86400;
    }
    if (unit === "week") {
      return n * 604800;
    }
    if (unit === "month") {
      return n * 2592000;
    }
    if (unit === "year") {
      return n * 31536000;
    }
  }

  return null;
};
const resolveToHours = (value) => {
  const seconds = parseDurationToSeconds(value);
  if (seconds === null) {
    return value;
  }
  return seconds / 3600;
};
const resolveToMinutes = (value) => {
  const seconds = parseDurationToSeconds(value);
  if (seconds === null) {
    return value;
  }
  return seconds / 60;
};
const resolveToSeconds = (value) => {
  const seconds = parseDurationToSeconds(value);
  if (seconds === null) {
    return value;
  }
  return seconds;
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
  return CANNOT_CONVERT;
};

export const TYPES = {
  "boolean": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    representations: {
      string: {
        parse: (value) => {
          if (value === "true") return true;
          if (value === "false") return false;
          if (value === "on") return true;
          if (value === "off") return false;
          if (value === "1") return true;
          if (value === "0") return false;
          return CANNOT_CONVERT;
        },
        format: String,
      },
      number: {
        parse: (value) => {
          if (value === 0) return false;
          if (value === 1) return true;
          return CANNOT_CONVERT;
        },
        format: (value) => (value ? 1 : 0),
      },
    },
  },
  "number": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    validate: validateNumber,
    representations: {
      string: {
        parse: convertStringToNumber,
        format: String,
      },
    },
  },
  "string": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    representations: {
      number: {
        parse: String,
        format: Number,
      },
      boolean: {
        parse: String,
        format: (value) => {
          if (value === "true") return true;
          if (value === "false") return false;
          return CANNOT_CONVERT;
        },
      },
    },
  },
  "array": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    validate: (value) => {
      if (!Array.isArray(value)) {
        return `must be an array, got ${typeof value}`;
      }
      return "";
    },
    representations: {
      string: {
        parse: (value) => {
          try {
            const parsed = JSON.parse(value);
            return parsed;
          } catch {
            return CANNOT_CONVERT;
          }
        },
        format: JSON.stringify,
      },
    },
  },
  "object": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    validate: (value) => {
      if (Array.isArray(value)) {
        return `must be an object, got array`;
      }
      if (typeof value !== "object" || value === null) {
        return `must be an object, got ${typeof value}`;
      }
      return "";
    },
    representations: {
      string: {
        parse: (value) => {
          try {
            const parsed = JSON.parse(value);
            return parsed;
          } catch {
            return CANNOT_CONVERT;
          }
        },
        format: JSON.stringify,
      },
    },
  },
  "date": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    // canonical: Date object
    representations: {
      // "YYYY-MM-DD" string — also used for auto-converting string inputs
      string: {
        parse: (s) => {
          const d = new Date(`${s}T00:00:00`);
          return isNaN(d.getTime()) ? CANNOT_CONVERT : d;
        },
        format: (d) => {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        },
      },
      // Unix timestamp — also used for auto-converting number inputs
      number: {
        parse: (n) => {
          const d = new Date(n);
          return isNaN(d.getTime()) ? CANNOT_CONVERT : d;
        },
        format: (d) => d.getTime(),
      },
    },
    validate: (value) => {
      if (value instanceof Date) {
        return isNaN(value.getTime()) ? `must be a valid date` : "";
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return ""; // timestamp
      }
      if (typeof value !== "string") {
        return `must be a string in YYYY-MM-DD format, a timestamp, or a Date object`;
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
  "datetime": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
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
  // "datetime-local" matches the value format of <input type="datetime-local">: "YYYY-MM-DDTHH:MM"
  "datetime-local": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    validate: (value) => {
      if (typeof value !== "string") {
        return `must be a string in YYYY-MM-DDTHH:MM format`;
      }
      const regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;
      if (!regex.test(value)) {
        return `must be in YYYY-MM-DDTHH:MM format`;
      }
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        return `must be a valid datetime`;
      }
      return "";
    },
    representations: {
      object: {
        parse: (value) => {
          if (!(value instanceof Date) || isNaN(value.getTime())) {
            return CANNOT_CONVERT;
          }
          const yyyy = value.getFullYear();
          const mm = String(value.getMonth() + 1).padStart(2, "0");
          const dd = String(value.getDate()).padStart(2, "0");
          const hh = String(value.getHours()).padStart(2, "0");
          const min = String(value.getMinutes()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        },
        format: (value) => new Date(value),
      },
      number: {
        parse: (value) => {
          const d = new Date(value);
          if (isNaN(d.getTime())) {
            return CANNOT_CONVERT;
          }
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
        },
        format: (value) => new Date(value).getTime(),
      },
    },
  },
  // number/derived
  "float": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    validate: validateNumber,
    representations: {
      string: {
        parse: convertStringToNumber,
        format: String,
      },
    },
  },
  "integer": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
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
    representations: {
      string: {
        parse: (value) => {
          const result = convertStringToNumber(value);
          if (result === CANNOT_CONVERT) {
            return CANNOT_CONVERT;
          }
          return Math.round(result);
        },
        format: String,
      },
      number: {
        parse: (value) => Math.round(value),
        format: (value) => value,
      },
    },
  },
  "ratio": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    props: {
      min: { default: 0 },
      max: { default: 1 },
    },
    validate: validateNumber,
    representations: {
      string: {
        parse: convertStringToNumber,
        format: String,
      },
    },
  },
  "longitude": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    props: {
      min: { default: -180 },
      max: { default: 180 },
    },
    validate: validateNumber,
    representations: {
      string: {
        parse: convertStringToNumber,
        format: String,
      },
    },
  },
  "latitude": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    props: {
      min: { default: -90 },
      max: { default: 90 },
    },
    validate: validateNumber,
    representations: {
      string: {
        parse: convertStringToNumber,
        format: String,
      },
    },
  },
  "second": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    props: {
      min: { default: 0, resolver: resolveToSeconds },
      max: { default: 60, resolver: resolveToSeconds },
      step: { default: 1, resolver: resolveToSeconds },
    },
    // canonical: number of seconds (e.g. 90)
    representations: {
      string: {
        parse: (value) => {
          const fromDuration = resolveToSeconds(value);
          if (typeof fromDuration === "number") {
            return fromDuration;
          }
          return convertStringToNumber(value);
        },
        format: formatSeconds,
      },
    },
    validate: (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return "";
      }
      return `must be a number`;
    },
  },
  "minute": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    props: {
      min: { default: 0, resolver: resolveToMinutes },
      max: { default: 60, resolver: resolveToMinutes },
      step: { default: 1, resolver: resolveToMinutes },
    },
    // canonical: number of minutes (e.g. 90)
    representations: {
      string: {
        parse: (value) => {
          const fromDuration = resolveToMinutes(value);
          if (typeof fromDuration === "number") {
            return fromDuration;
          }
          return convertStringToNumber(value);
        },
        format: formatMinutes,
      },
    },
    validate: (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return "";
      }
      return `must be a number`;
    },
  },
  "hour": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    props: {
      min: { default: 0, resolver: resolveToHours },
      max: { default: 24, resolver: resolveToHours },
      step: { default: 1, resolver: resolveToHours },
    },
    // canonical: number of hours (e.g. 1.5)
    representations: {
      string: {
        parse: (value) => {
          const fromDuration = resolveToHours(value);
          if (typeof fromDuration === "number") {
            return fromDuration;
          }
          return convertStringToNumber(value);
        },
        format: formatHours,
      },
    },
    validate: (value) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return "";
      }
      return `must be a number`;
    },
  },
  // "week" matches the value format of <input type="week">: "YYYY-Www" (e.g. "2024-W03")
  "week": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    validate: (value) => {
      if (typeof value !== "string") {
        return `must be a string in YYYY-Www format`;
      }
      const weekRegex = /^\d{4}-W(?:0[1-9]|[1-4][0-9]|5[0-3])$/;
      if (!weekRegex.test(value)) {
        return `must be in YYYY-Www format (e.g. "2024-W03")`;
      }
      return "";
    },
  },
  "month": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
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
  // "year" is a plain number (e.g. 2024)
  "year": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    validate: (value) => {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        return `must be an integer year`;
      }
      return "";
    },
    representations: {
      string: {
        parse: (value) => {
          const parsed = parseInt(value, 10);
          if (!isNaN(parsed) && String(parsed) === value.trim()) {
            return parsed;
          }
          return CANNOT_CONVERT;
        },
        format: String,
      },
    },
  },
  "percentage": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
    props: {
      min: { default: 0 },
      max: { default: 100 },
    }, // canonical: number (e.g. 50)
    representations: {
      // "50%" string — also used for auto-converting string inputs
      string: {
        parse: (s) => {
          const trimmed =
            typeof s === "string" && s.endsWith("%") ? s.slice(0, -1) : s;
          const parsed = parseFloat(trimmed);
          return !isNaN(parsed) && isFinite(parsed) ? parsed : CANNOT_CONVERT;
        },
        format: (n) => `${n}%`,
      },
    },
    validate: (value) => {
      if (typeof value !== "number") {
        return `must be a number between 0 and 100`;
      }
      if (!Number.isFinite(value)) {
        return `must be finite`;
      }
      if (value < 0 || value > 100) {
        return `must be between 0 and 100`;
      }
      return "";
    },
  },
  // string/advanced
  "time": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
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
  "email": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
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
  "url": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
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
  "color": {
    localStorageRepresentation: "string",
    urlRepresentation: "string",
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
