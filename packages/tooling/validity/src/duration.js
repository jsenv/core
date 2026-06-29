/**
 * Parses a duration string or object into a plain object with named unit keys.
 *
 * Accepts two string formats:
 * - ISO 8601: "PT2H15M", "P1Y2M3DT4H5M6S", "P3W"
 * - Human-friendly: one or more `<value><unit>` pairs in any order,
 *   e.g. "2h", "15min", "1h30", "2 hours 15 minutes", "1year2months3days".
 *   Units accept plural, singular, and short forms ("hours"/"hour"/"h",
 *   "minutes"/"minute"/"min"/"m", "months"/"month"/"mo", etc.).
 *   Spaces between the number and unit are ignored.
 *   A trailing number with no unit is inferred as the next smaller unit
 *   after the last explicitly matched one (e.g. "1h30" → hours=1, minutes=30).
 *
 * Values in the returned object are **numbers** when the input is numeric,
 * or **strings** for mid-edit / non-numeric values (e.g. "1a" for hours).
 * A plain object input is returned as a shallow clone (passthrough).
 * Any other non-string input returns `null`.
 *
 * @param {string|number|Object} value - A duration string, a number of seconds, or a pre-parsed duration object.
 * @returns {{ years?: number|string, months?: number|string, weeks?: number|string,
 *             days?: number|string, hours?: number|string, minutes?: number|string,
 *             seconds?: number|string, milliseconds?: number|string }|null}
 *   An object containing only the units present in the input, or `null` if the
 *   value cannot be parsed.
 *
 * @example
 * parseDuration("2h")                // { hours: 2 }
 * parseDuration("1h30")             // { hours: 1, minutes: 30 }
 * parseDuration("2h 15min")         // { hours: 2, minutes: 15 }
 * parseDuration("1 hour 30 minutes") // { hours: 1, minutes: 30 }
 * parseDuration("-1.5s")            // { seconds: -1.5 }
 * parseDuration("1aday")            // { days: "1a" }  — mid-edit, non-numeric preserved
 * parseDuration("PT2H15M")          // { hours: 2, minutes: 15 }
 * parseDuration({ hours: 2 })       // { hours: 2 }
 * parseDuration(3600)               // { seconds: 3600 }  — number treated as seconds
 * parseDuration("30")               // null — no unit and no context
 * parseDuration(null)               // null
 */
export const parseDuration = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    return { ...value };
  }
  if (typeof value === "number") {
    return isFinite(value) ? { seconds: value } : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  let s = value.trim();
  if (s === "") {
    return null;
  }

  // ISO 8601 duration: P[nY][nM][nW][nD][T[nH][nM][nS]]
  // e.g. "PT1H30M", "P1Y2M3DT4H5M6S", "P3W", case-insensitive
  if (s[0] === "P" || s[0] === "p") {
    return parseISODuration(s);
  }

  // Spaces are allowed between number and unit (e.g. "2 hours 15 minutes").
  // Strip them so the rest of the parser can work on a compact string.
  s = s.split(" ").join("");

  const result = {};
  let lastMatchedUnitIndex = -1;
  for (let unitIndex = 0; unitIndex < UNITS.length; unitIndex++) {
    const { key, aliases } = UNITS[unitIndex];
    const match = findUnitMatch(s, aliases);
    if (match === null) {
      continue;
    }
    const { idx, aliasLength } = match;
    const rawValue = s.slice(0, idx);
    const remainder = s.slice(idx + aliasLength);
    if (rawValue !== "") {
      const num = Number(rawValue);
      result[key] = isFinite(num) ? num : rawValue;
    }
    lastMatchedUnitIndex = unitIndex;
    s = remainder;
    if (s === "") {
      break;
    }
  }

  // If there is a trailing value with no unit (e.g. "1h30"), infer the next
  // smaller unit after the last matched one ("30" → minutes after hours).
  if (s !== "" && lastMatchedUnitIndex !== -1) {
    const nextUnitIndex = lastMatchedUnitIndex + 1;
    if (nextUnitIndex < UNITS.length) {
      const { key } = UNITS[nextUnitIndex];
      if (result[key] === undefined) {
        const num = Number(s);
        result[key] = isFinite(num) ? num : s;
        s = "";
      }
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
// Returns { idx, aliasLength } for the last occurrence of any alias in `aliases`
// within `s` that is a valid standalone match:
//   - not preceded by characters that make it a suffix of a longer known alias
//     (e.g. "second" inside "millisecond")
//   - not followed by a letter that would extend it into a longer word
//     (e.g. "m" at the start of "ms", or "h" inside "hour")
// Aliases are sorted longest-first so that e.g. "minutes" is tried before
// "minute" — otherwise "minute" would match in "30minutes" and leave a
// trailing "s" that could be mistakenly consumed by the seconds alias.
// Returns null when no valid match exists.
const findUnitMatch = (s, aliases) => {
  const sortedAliases = [...aliases].sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    let idx = s.lastIndexOf(alias);
    while (idx !== -1) {
      if (
        !isEmbeddedInLongerAlias(s, alias, idx) &&
        !isFollowedByLetter(s, idx + alias.length)
      ) {
        return { idx, aliasLength: alias.length };
      }
      idx = s.lastIndexOf(alias, idx - 1);
    }
  }
  return null;
};
// True when the character at `pos` is a lowercase letter — meaning the alias
// immediately before it is a prefix of a longer word, not a standalone unit name.
const isFollowedByLetter = (s, pos) => {
  const ch = s[pos];
  return ch !== undefined && ch >= "a" && ch <= "z";
};
// True when alias at position `idx` in `s` is preceded by characters that form
// the prefix of a longer known alias (e.g. "second" at 5 in "millisecond",
// or "s" at 1 in "ms").
const isEmbeddedInLongerAlias = (s, alias, idx) => {
  for (const unit of UNITS) {
    for (const otherAlias of unit.aliases) {
      if (otherAlias.length <= alias.length || !otherAlias.endsWith(alias)) {
        continue;
      }
      const prefix = otherAlias.slice(0, otherAlias.length - alias.length);
      if (
        idx >= prefix.length &&
        s.slice(idx - prefix.length, idx) === prefix
      ) {
        return true;
      }
    }
  }
  return false;
};
// Parses the ISO 8601 portion of a duration string (P prefix already known).
// Uses character scanning instead of a regex so that non-numeric values between
// markers are preserved as strings (e.g. "PTabH" → { hours: "ab" },
// "PTaHH" → { hours: "aH" } because the LAST 'H' is the unit marker).
// Case-insensitive: "pt2h30m" is treated the same as "PT2H30M".
// Original casing of values is preserved so mid-edit strings round-trip cleanly.
const parseISODuration = (s) => {
  // Skip the leading P/p
  let rest = s.slice(1);

  // Split on the first T/t into date part (Y M W D) and time part (H M S)
  const tIdx = indexOfCI(rest, "T");
  let datePart;
  let timePart;
  if (tIdx === -1) {
    datePart = rest;
    timePart = "";
  } else {
    datePart = rest.slice(0, tIdx);
    timePart = rest.slice(tIdx + 1);
  }

  const result = {};

  // Date components: bracket-aware search so encoded values like "[2Y]" in a
  // months field are not split on the 'Y' inside the brackets.
  for (const [marker, key] of ISO_DATE_MARKERS) {
    const idx = lastIndexOfCIOutsideBrackets(datePart, marker);
    if (idx === -1) {
      continue;
    }
    let rawValue = datePart.slice(0, idx);
    datePart = datePart.slice(idx + 1);
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      rawValue = rawValue.slice(1, -1);
    }
    if (rawValue !== "") {
      const num = Number(rawValue);
      result[key] = isFinite(num) ? num : rawValue;
    }
  }

  // Time components: use bracket-aware search so that encoded values like
  // "[34h]" are not split on the 'h' inside the brackets.
  for (const [marker, key] of ISO_TIME_MARKERS) {
    const idx = lastIndexOfCIOutsideBrackets(timePart, marker);
    if (idx === -1) {
      continue;
    }
    let rawValue = timePart.slice(0, idx);
    timePart = timePart.slice(idx + 1);
    // Strip bracket escaping added by encodeTimeValue
    if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
      rawValue = rawValue.slice(1, -1);
    }
    if (rawValue !== "") {
      const num = Number(rawValue);
      result[key] = isFinite(num) ? num : rawValue;
    }
  }

  if (Object.keys(result).length === 0) {
    return null; // bare "P" or "PT" with no components
  }
  return result;
};
// When a non-numeric field value contains any ISO duration unit marker letter
// (Y/M/W/D/H/S, case-insensitive), wrapping it in [...] prevents
// parseISODuration from mistaking those letters for unit delimiters.
// Example: "34h" in minutes → "[34h]M" so the parser keeps it as minutes.
// Purely numeric values or values without marker chars are returned unchanged.
const encodeISOValue = (v) => {
  if (typeof v !== "string") return v;
  for (const ch of v) {
    const lo = ch.toLowerCase();
    if (
      lo === "y" ||
      lo === "m" ||
      lo === "w" ||
      lo === "d" ||
      lo === "h" ||
      lo === "s"
    )
      return `[${v}]`;
  }
  return v;
};

// Like lastIndexOfCI but skips characters inside [...] brackets so that
// escaped values (e.g. "[34h]") are never mistaken for ISO markers.
const lastIndexOfCIOutsideBrackets = (s, ch) => {
  const upper = ch.toUpperCase();
  const lower = ch.toLowerCase();
  let depth = 0;
  let lastFound = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "[") { depth++; continue; }
    if (s[i] === "]") { if (depth > 0) depth--; continue; }
    if (depth === 0 && (s[i] === upper || s[i] === lower)) lastFound = i;
  }
  return lastFound;
};

// Case-insensitive indexOf for a single character.
const indexOfCI = (s, ch) => {
  const upper = ch.toUpperCase();
  const lower = ch.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    if (s[i] === upper || s[i] === lower) {
      return i;
    }
  }
  return -1;
};

const ISO_DATE_MARKERS = [
  ["Y", "years"],
  ["M", "months"],
  ["W", "weeks"],
  ["D", "days"],
];
const ISO_TIME_MARKERS = [
  ["H", "hours"],
  ["M", "minutes"],
  ["S", "seconds"],
];

// Units ordered from largest to smallest.
// .name is the canonical English singular used as a lookup key (e.g. durationToNumber).
// .aliases lists every accepted spelling for the human-friendly parser
//   (findUnitMatch sorts them longest-first automatically).
//   Trying longest first ensures "millisecond" beats "second", "min" beats "m", etc.
// .seconds is the conversion factor to seconds (used by durationToNumber).
const UNITS = [
  {
    key: "years",
    name: "year",
    aliases: ["years", "year", "y"],
    seconds: 31536000,
  },
  {
    key: "months",
    name: "month",
    aliases: ["months", "month", "mo"],
    seconds: 2592000,
  },
  {
    key: "weeks",
    name: "week",
    aliases: ["weeks", "week", "w"],
    seconds: 604800,
  },
  {
    key: "days",
    name: "day",
    aliases: ["days", "day", "d"],
    seconds: 86400,
  },
  {
    key: "hours",
    name: "hour",
    aliases: ["hours", "hour", "h"],
    seconds: 3600,
  },
  {
    key: "minutes",
    name: "minute",
    aliases: ["minutes", "minute", "min", "m"],
    seconds: 60,
  },
  {
    key: "seconds",
    name: "second",
    aliases: ["seconds", "second", "sec", "s"],
    seconds: 1,
  },
  {
    key: "milliseconds",
    name: "millisecond",
    aliases: ["milliseconds", "millisecond", "ms"],
    seconds: 0.001,
  },
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
 * For fully-numeric durations this produces a valid ISO 8601 string, folding
 * milliseconds into the seconds component as a decimal fraction (e.g. 500ms
 * → 0.5S) and omitting zero-value fields.
 *
 * Non-numeric (mid-edit) unit values are embedded as-is between their ISO
 * markers so that the result can always be round-tripped back through
 * {@link parseDuration} (which uses `lastIndexOf` per marker). For example
 * `{ hours: "ab" }` → `"PTabH"` → `parseDuration` → `{ hours: "ab" }`.
 *
 * Milliseconds have no dedicated ISO marker and are silently ignored when
 * non-numeric. Returns `null` for empty durations or unparseable inputs.
 *
 * @param {string|Object|null} value - A duration string or a duration object.
 * @returns {string|null}
 *
 * @example
 * durationToISOString("2hour15minute")                    // "PT2H15M"
 * durationToISOString({ years: 1, months: 2 })            // "P1Y2M"
 * durationToISOString({ seconds: 1, milliseconds: 500 })  // "PT1.5S"
 * durationToISOString({ hours: "ab", minutes: 30 })       // "PTabH30M"
 * durationToISOString({ hours: "aH", minutes: 30 })       // "PTaHH30M"  (parser: last H wins)
 * durationToISOString("30")                               // null — no unit
 * durationToISOString(null)                               // null
 */
export const durationToISOString = (value) => {
  const duration =
    typeof value === "object" && value !== null ? value : parseDuration(value);
  if (!duration) {
    return null;
  }
  const resolveValue = (key) => {
    const v = duration[key];
    if (v === undefined || v === null) {
      return null;
    }
    const n = Number(v);
    return isFinite(n) ? n : String(v);
  };
  const years = resolveValue("years");
  const months = resolveValue("months");
  const weeks = resolveValue("weeks");
  const days = resolveValue("days");
  const hours = resolveValue("hours");
  const minutes = resolveValue("minutes");
  const secs = resolveValue("seconds");
  const ms = resolveValue("milliseconds");
  let date = "";
  if (years !== null) {
    date += `${encodeISOValue(years)}Y`;
  }
  if (months !== null) {
    date += `${encodeISOValue(months)}M`;
  }
  if (weeks !== null) {
    date += `${encodeISOValue(weeks)}W`;
  }
  if (days !== null) {
    date += `${encodeISOValue(days)}D`;
  }
  let time = "";
  if (hours !== null) {
    time += `${encodeISOValue(hours)}H`;
  }
  if (minutes !== null) {
    time += `${encodeISOValue(minutes)}M`;
  }
  if (typeof secs === "string") {
    // Non-numeric seconds — embed with bracket escaping if needed
    time += `${encodeISOValue(secs)}S`;
  } else {
    // Numeric path — fold ms into seconds; include even if total is 0 so that
    // an explicitly-set field (user typed "0") is preserved in the output
    const numSecs = secs ?? 0;
    const numMs = typeof ms === "number" ? ms : 0;
    const totalSeconds = numSecs + numMs / 1000;
    if (secs !== null || (ms !== null && typeof ms === "number")) {
      time += `${totalSeconds}S`;
    }
  }
  const result = `P${date}${time ? `T${time}` : ""}`;
  return result === "P" ? null : result;
};

/**
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

/**
 * Compares two duration values (strings or numbers of seconds).
 * Mirrors the Temporal.Duration.compare API — returns -1, 0, or 1.
 * Returns null if either value cannot be converted to seconds.
 *
 * @param {string|number} a
 * @param {string|number} b
 * @returns {-1|0|1|null}
 *
 * @example
 * compareTwoDurations("1hour", "30minute")   // 1  (1h > 30min)
 * compareTwoDurations("30minute", "1hour")   // -1
 * compareTwoDurations("1hour", 3600)         // 0  (number treated as seconds)
 * compareTwoDurations("invalid", "1hour")    // null
 */
export const compareTwoDurations = (a, b) => {
  const aSeconds = typeof a === "number" ? a : durationToSeconds(a);
  const bSeconds = typeof b === "number" ? b : durationToSeconds(b);
  if (aSeconds === null || bSeconds === null) {
    return null;
  }
  if (aSeconds < bSeconds) {
    return -1;
  }
  if (aSeconds > bSeconds) {
    return 1;
  }
  return 0;
};

/**
 * Returns true if the duration value contains any non-numeric (mid-edit) unit value.
 * Use this to skip min/max/step validation while the user is still typing.
 *
 * @param {string|number|Object|null} value
 * @returns {boolean}
 *
 * @example
 * durationContainsNaN("PTaH15M")            // true  — hours is "a"
 * durationContainsNaN({ hours: "2a" })      // true  — non-numeric hours
 * durationContainsNaN("PT2H15M")            // false — fully numeric
 * durationContainsNaN("")                   // false — empty, not mid-edit
 * durationContainsNaN(null)                 // false
 */
export const durationContainsNaN = (value) => {
  const duration = parseDuration(value);
  if (!duration) {
    return false;
  }
  for (const { key } of UNITS) {
    const v = duration[key];
    if (v !== undefined && v !== null && !isFinite(Number(v))) {
      return true;
    }
  }
  return false;
};
