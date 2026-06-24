// Parses a duration string into a total number of seconds.
// Supported notations:
//   shorthand     "2h15" → 2h + 15min (number after h, no unit needed)
//   single unit   "5s" / "5second", "10min" / "10minute"
//                 "2h" / "2hour", "3d" / "3day"
//                 "2w" / "2week", "1month", "1year"
//   compound      "1h20min" → 1h + 20min, "1h20min30s" → 1h + 20min + 30s
// A bare number without a unit (e.g. "30") returns null.
// Returns null when the value cannot be parsed.
export const parseDurationToSeconds = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const str = value.trim();

  // Shorthand: "2h15" or "2h" — number after 'h' (no 'min' suffix) counts as minutes.
  // This is matched before the compound regex to avoid "2h15" being rejected.
  const shorthandMatch = /^(\d+(?:\.\d+)?)h(\d+(?:\.\d+)?)?$/.exec(str);
  if (shorthandMatch) {
    const h = parseFloat(shorthandMatch[1]);
    const min = shorthandMatch[2] ? parseFloat(shorthandMatch[2]) : 0;
    return h * 3600 + min * 60;
  }

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

// Parses the STRUCTURE of a duration string into its raw component parts,
// preserving invalid mid-edit values (e.g. "2ah15" → { hour: "2a", minute: "15" }).
//
// Format rules (same as parseDurationToSeconds):
//   "2h15"    → { hour: "2",  minute: "15" }
//   "2h15min" → { hour: "2",  minute: "15" }
//   "2h"      → { hour: "2",  minute: undefined }
//   "h15"     → { hour: "",   minute: "15" }  (empty hour = not entered)
//   "15min"   → { hour: undefined, minute: "15" }
//   "2ah15"   → { hour: "2a", minute: "15" }  (invalid hour preserved)
//   "2h1a5"   → { hour: "2",  minute: "1a5" } (invalid minute preserved)
//   ""        → { hour: undefined, minute: undefined }
//
// Returns null when the string has no recognisable unit/separator ("30" alone).
export const parseDurationComponents = (value) => {
  if (value == null || value === "") {
    return { hour: undefined, minute: undefined };
  }
  const s = String(value).trim();
  if (s === "") {
    return { hour: undefined, minute: undefined };
  }

  // "h" acts as both the hour unit and the hours/minutes separator.
  const hIndex = s.indexOf("h");
  if (hIndex !== -1) {
    const hourPart = s.slice(0, hIndex); // raw hours string, may be invalid
    let minutePart = s.slice(hIndex + 1); // raw minutes string, may be invalid
    // Strip trailing "min" if present (normalise "2h15min" → minute="15")
    if (minutePart.endsWith("min")) {
      minutePart = minutePart.slice(0, -3);
    }
    return {
      hour: hourPart === "" ? undefined : hourPart,
      minute: minutePart === "" ? undefined : minutePart,
    };
  }

  // No "h": look for "min" or "s" suffix.
  if (s.endsWith("min")) {
    const minutePart = s.slice(0, -3);
    return {
      hour: undefined,
      minute: minutePart === "" ? undefined : minutePart,
    };
  }
  if (s.endsWith("s")) {
    return { hour: undefined, minute: undefined }; // seconds not used by InputDuration
  }

  // No unit/separator — ambiguous (e.g. "30"). Return null to signal invalid format.
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

// Formats a number of milliseconds as a short duration string.
//
// Rules:
//   - No rounding: full precision is preserved
//   - Always short unit notation: ms, s, m, h
//   - Sub-ms values        → "0.1ms"
//   - < 1s, ≤2 decimal places as seconds → "0.1s", "0.01s"
//   - < 1s, 3+ decimal places as seconds → "1ms", "10ms", "100ms"
//   - ≥ 1s                 → compound units: "1m1s", "1h30m", "1h30m30.5s"
//
// Examples:
//   formatSeconds(0.1)    → "0.1s"
//   formatSeconds(0.01)   → "0.01s"
//   formatSeconds(0.001)  → "1ms"
//   formatSeconds(61)     → "1m1s"
//   formatMinutes(90)     → "1h30m"
//   formatHours(1.5)      → "1h30m"

export const formatSeconds = (s) =>
  s === 0 ? "0s" : formatDurationMs(s * 1_000);
export const formatMinutes = (m) =>
  m === 0 ? "0m" : formatDurationMs(m * 60_000);
export const formatHours = (h) =>
  h === 0 ? "0h" : formatDurationMs(h * 3_600_000);

const formatDurationMs = (rawMs) => {
  // Clean up floating point noise (round to nearest microsecond)
  const totalMs = Math.round(rawMs * 1e3) / 1e3;
  if (totalMs === 0) {
    return "0s";
  }
  if (totalMs < 1) {
    return `${trimDecimal(totalMs)}ms`;
  }
  if (totalMs < 1000) {
    const asSec = totalMs / 1000;
    const asSecStr = trimDecimal(asSec);
    const decimalPart = asSecStr.split(".")[1] || "";
    if (decimalPart.length <= 2) {
      return `${asSecStr}s`;
    }
    return `${trimDecimal(totalMs)}ms`;
  }
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = (totalMs % 60_000) / 1_000;
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${trimDecimal(seconds)}s`);
  }
  return parts.join("");
};

const trimDecimal = (n) => {
  const s = String(n);
  if (!s.includes(".")) {
    return s;
  }
  return s.replace(/\.?0+$/, "");
};
