// Units ordered from largest to smallest.
// .name is the keyword used in duration strings (singular, no trailing "s").
// .seconds is the conversion factor for durationToSeconds.
const UNITS = [
  { key: "years", name: "year", seconds: 31536000 },
  { key: "months", name: "month", seconds: 2592000 },
  { key: "weeks", name: "week", seconds: 604800 },
  { key: "days", name: "day", seconds: 86400 },
  { key: "hours", name: "hour", seconds: 3600 },
  { key: "minutes", name: "minute", seconds: 60 },
  { key: "seconds", name: "second", seconds: 1 },
  { key: "milliseconds", name: "millisecond", seconds: 0.001 },
];

// Returns the index of the last occurrence of `name` in `s` where it is NOT
// embedded inside a longer known unit name (e.g. "second" inside "millisecond").
// This prevents matching "second" in "1second140millisecond" at the wrong position
// while still allowing invalid value characters like "2a" in "2ahour".
const findUnitIndex = (s, name) => {
  let idx = s.lastIndexOf(name);
  while (idx !== -1) {
    let isPartOfLongerUnit = false;
    for (const unit of UNITS) {
      if (unit.name === name || !unit.name.endsWith(name)) {
        continue;
      }
      const prefix = unit.name.slice(0, unit.name.length - name.length);
      if (
        idx >= prefix.length &&
        s.slice(idx - prefix.length, idx) === prefix
      ) {
        isPartOfLongerUnit = true;
        break;
      }
    }
    if (!isPartOfLongerUnit) {
      return idx;
    }
    idx = s.lastIndexOf(name, idx - 1);
  }
  return -1;
};

//
// Algorithm: scan left-to-right by unit size (year -> millisecond). For each
// unit, find its last boundary-aware occurrence in the remaining string (the
// character before the unit name must be non-alphabetic). Everything to the
// left is the raw value for that unit, preserved as-is even if invalid.
//
//   "2ahour"             -> { hours: "2a" }          invalid value, preserved
//   "-1second"           -> { seconds: "-1" }         negative sign supported
//   "1.14second"         -> { seconds: "1.14" }       decimal preserved
//   "1second140millisecond" -> { seconds: "1", milliseconds: "140" }
//
// Input can be:
//   - a string: "2hour", "15minute", "2hour15minute", "1year2month3day"
//   - a plain object: passed through as-is (shallow clone)
//   - anything else: returns null
//
// Values in the returned object are raw strings, not numbers. No trimming
// is applied to values — spaces are preserved as-is so callers can see them.
// Use durationToSeconds() for numeric conversion and validation.
//
// Examples:
//   parseDuration("2hour")                    -> { hours: "2" }
//   parseDuration("2hour15minute")            -> { hours: "2", minutes: "15" }
//   parseDuration("-1second")                 -> { seconds: "-1" }
//   parseDuration("1second140millisecond")    -> { seconds: "1", milliseconds: "140" }
//   parseDuration("1.14second")               -> { seconds: "1.14" }
//   parseDuration("2ahour")                   -> { hours: "2a" }
//   parseDuration("30")                       -> null  (no unit)
//   parseDuration({ hours: 2 })               -> { hours: 2 }  (object passthrough)
//   parseDuration(null)                       -> null
export const parseDuration = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    return { ...value };
  }
  if (typeof value !== "string") {
    return null;
  }
  let s = value.trim();
  if (s === "") {
    return null;
  }

  const result = {};
  for (const { key, name } of UNITS) {
    const idx = findUnitIndex(s, name);
    if (idx === -1) {
      continue;
    }
    const rawValue = s.slice(0, idx);
    const remainder = s.slice(idx + name.length);
    if (rawValue !== "") {
      result[key] = rawValue;
    }
    s = remainder;
    if (s === "") {
      break;
    }
  }

  // Leftover text has no matching unit -- the string is not a valid duration.
  if (s.trim() !== "") {
    return null;
  }
  if (Object.keys(result).length === 0) {
    return null;
  }
  return result;
};

// Serialises a duration object back to a string.
// Each unit is written as <rawValue><unitName> with no separator between units.
// Units always appear in order from largest to smallest.
//
// Values may be numbers or strings. Negative values are preserved (e.g.
// { seconds: "-1" } -> "-1second").
//
// Examples:
//   durationToString({ hours: 2, minutes: 15 })          -> "2hour15minute"
//   durationToString({ years: 1, months: 2 })            -> "1year2month"
//   durationToString({ hours: "2a" })                    -> "2ahour"
//   durationToString({ seconds: "-1" })                  -> "-1second"
//   durationToString({ seconds: 1, milliseconds: 140 })  -> "1second140millisecond"
//   durationToString({})                                  -> null
//   durationToString(null)                                -> null
export const durationToString = (duration) => {
  if (!duration || typeof duration !== "object") {
    return null;
  }
  const parts = [];
  for (const { key, name } of UNITS) {
    if (duration[key] !== undefined && duration[key] !== null) {
      parts.push(String(duration[key]) + name);
    }
  }
  if (parts.length === 0) {
    return null;
  }
  return parts.join("");
};

// Returns the total duration as a number of seconds.
// Accepts either a duration string or a duration object.
// Returns null if the value cannot be parsed or any unit value is not a finite number.
//
// Examples:
//   durationToSeconds("2hour15minute")           -> 8100
//   durationToSeconds({ hours: 2, minutes: 15 }) -> 8100
//   durationToSeconds("30")                      -> null  (no unit)
//   durationToSeconds({ hours: "2a" })           -> null  (invalid number)
//   durationToSeconds(null)                      -> null
export const durationToSeconds = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  let duration;
  if (typeof value === "object") {
    duration = value;
  } else if (typeof value === "string") {
    duration = parseDuration(value);
    if (duration === null) {
      return null;
    }
  } else {
    return null;
  }
  let total = 0;
  for (const { key, seconds } of UNITS) {
    if (duration[key] === undefined || duration[key] === null) {
      continue;
    }
    const n = Number(duration[key]);
    if (!isFinite(n)) {
      return null;
    }
    total += n * seconds;
  }
  return total;
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
