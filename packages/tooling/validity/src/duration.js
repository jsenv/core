/**
 * Parses a duration string or object into a plain object with named unit keys.
 *
 * Supported string format: one or more `<value><unit>` pairs in any order,
 * e.g. `"2hour"`, `"15minute"`, `"2hour15minute"`, `"1year2month3day"`.
 * Supported units: `year`, `month`, `week`, `day`, `hour`, `minute`, `second`, `millisecond`.
 *
 * Values in the returned object are **raw strings**, not numbers, so invalid
 * or unusual input is preserved for the caller to inspect. Use
 * {@link durationToSeconds} when you need a numeric result.
 *
 * A plain object input is returned as a shallow clone (passthrough). Any other
 * non-string input returns `null`.
 *
 * @param {string|Object} value - A duration string or a pre-parsed duration object.
 * @returns {{ years?: string, months?: string, weeks?: string, days?: string,
 *             hours?: string, minutes?: string, seconds?: string, milliseconds?: string }|null}
 *   An object containing only the units present in the input, or `null` if the
 *   value cannot be parsed.
 *
 * @example
 * parseDuration("2hour")             // { hours: "2" }
 * parseDuration("2hour15minute")     // { hours: "2", minutes: "15" }
 * parseDuration("-1second")          // { seconds: "-1" }
 * parseDuration("1.14second")        // { seconds: "1.14" }
 * parseDuration({ hours: 2 })        // { hours: 2 }
 * parseDuration("30")                // null — no unit
 * parseDuration(null)                // null
 */
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

  // ISO 8601 duration: P[nY][nM][nW][nD][T[nH][nM][nS]]
  // e.g. "PT1H30M", "P1Y2M3DT4H5M6S", "P3W"
  if (s[0] === "P" || s[0] === "p") {
    return parseISODuration(s.toUpperCase());
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
// ISO 8601 duration regex: P[nY][nM][nW][nD][T[nH][nM][nS]]
const ISO_DURATION_RE =
  /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
const parseISODuration = (s) => {
  const match = ISO_DURATION_RE.exec(s);
  if (!match) {
    return null;
  }
  const [, y, mo, w, d, h, min, sec] = match;
  if (!y && !mo && !w && !d && !h && !min && !sec) {
    return null; // bare "P" with no components
  }
  const result = {};
  if (y) {
    result.years = y;
  }
  if (mo) {
    result.months = mo;
  }
  if (w) {
    result.weeks = w;
  }
  if (d) {
    result.days = d;
  }
  if (h) {
    result.hours = h;
  }
  if (min) {
    result.minutes = min;
  }
  if (sec) {
    result.seconds = sec;
  }
  return result;
};

// Units ordered from largest to smallest.
// .name is the keyword used in duration strings (singular, no trailing "s").
// .seconds is the conversion factor to seconds (used by durationToNumber).
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

/**
 * Serialises a duration object back to a duration string.
 *
 * Each unit is written as `<value><unitName>` with no separator, always in
 * order from largest to smallest unit. Values may be numbers or strings;
 * non-numeric and negative values are preserved as-is. Returns `null` for
 * empty objects or non-object inputs.
 *
 * @param {{ years?: any, months?: any, weeks?: any, days?: any,
 *           hours?: any, minutes?: any, seconds?: any, milliseconds?: any }|null} duration
 * @returns {string|null}
 *
 * @example
 * durationToString({ hours: 2, minutes: 15 })          // "2hour15minute"
 * durationToString({ years: 1, months: 2 })            // "1year2month"
 * durationToString({ hours: "2a" })                    // "2ahour"
 * durationToString({ seconds: "-1" })                  // "-1second"
 * durationToString({ seconds: 1, milliseconds: 140 })  // "1second140millisecond"
 * durationToString({})                                 // null
 * durationToString(null)                               // null
 */
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

/**
 * Serialises a duration object or string to an ISO 8601 duration string.
 *
 * Milliseconds are folded into the seconds component as a decimal fraction
 * (e.g. 500ms → 0.5S). Returns `null` for non-numeric unit values, empty
 * durations, or inputs that cannot be parsed.
 *
 * @param {string|Object|null} value - A duration string or a duration object.
 * @returns {string|null}
 *
 * @example
 * durationToISOString("2hour15minute")                    // "PT2H15M"
 * durationToISOString({ years: 1, months: 2 })            // "P1Y2M"
 * durationToISOString({ seconds: 1, milliseconds: 500 })  // "PT1.5S"
 * durationToISOString("30")                               // null — no unit
 * durationToISOString({ hours: "2a" })                    // null — invalid number
 * durationToISOString(null)                               // null
 */
export const durationToISOString = (value) => {
  const duration =
    typeof value === "object" && value !== null ? value : parseDuration(value);
  if (!duration) {
    return null;
  }
  const toNum = (key) => {
    const v = duration[key];
    if (v === undefined || v === null) {
      return 0;
    }
    const n = Number(v);
    return isFinite(n) ? n : null;
  };
  const years = toNum("years");
  const months = toNum("months");
  const weeks = toNum("weeks");
  const days = toNum("days");
  const hours = toNum("hours");
  const minutes = toNum("minutes");
  const secs = toNum("seconds");
  const ms = toNum("milliseconds");
  if (
    years === null ||
    months === null ||
    weeks === null ||
    days === null ||
    hours === null ||
    minutes === null ||
    secs === null ||
    ms === null
  ) {
    return null;
  }
  const totalSeconds = secs + ms / 1000;
  let date = "";
  if (years) date += `${years}Y`;
  if (months) date += `${months}M`;
  if (weeks) date += `${weeks}W`;
  if (days) date += `${days}D`;
  let time = "";
  if (hours) time += `${hours}H`;
  if (minutes) time += `${minutes}M`;
  if (totalSeconds) time += `${totalSeconds}S`;
  const result = `P${date}${time ? `T${time}` : ""}`;
  return result === "P" ? null : result;
};

/**
 * Returns the total duration as a number in the given unit.
 *
 * Accepts either a duration string (parsed via {@link parseDuration}) or a
 * pre-parsed duration object. Returns `null` if the value cannot be parsed,
 * if any unit value is not a finite number, or if `unit` is not recognised.
 *
 * @param {string|Object|null} value - A duration string or a duration object.
 * @param {string} unit - Target unit name (e.g. `"second"`, `"minute"`, `"hour"`).
 * @returns {number|null}
 *
 * @example
 * durationToNumber("2hour15minute", "minute")           // 135
 * durationToNumber({ hours: 2, minutes: 15 }, "minute") // 135
 * durationToNumber("30", "second")                      // null — no unit
 * durationToNumber({ hours: "2a" }, "second")           // null — invalid number
 * durationToNumber(null, "second")                      // null
 */
export const durationToNumber = (value, unit) => {
  if (value === null || value === undefined) {
    return null;
  }
  const targetUnit = UNITS.find((u) => u.name === unit);
  if (!targetUnit) {
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
  let totalSeconds = 0;
  for (const { key, seconds } of UNITS) {
    if (duration[key] === undefined || duration[key] === null) {
      continue;
    }
    const n = Number(duration[key]);
    if (!isFinite(n)) {
      return null;
    }
    totalSeconds += n * seconds;
  }
  return totalSeconds / targetUnit.seconds;
};
export const durationToSeconds = (value) => durationToNumber(value, "second");
export const durationToMinutes = (value) => durationToNumber(value, "minute");
export const durationToHours = (value) => durationToNumber(value, "hour");
