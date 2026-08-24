/**
 * Parses a time string into seconds.
 * Accepts:
 *   - number: returned as-is (already in seconds)
 *   - "HH:MM" string: converted to seconds (e.g. "00:30" → 1800, "01:00" → 3600)
 *   - undefined/null: returned as-is
 */
export const timeStringToSeconds = (timeString) => {
  if (typeof timeString !== "string") {
    return timeString;
  }
  const colonIndex = timeString.indexOf(":");
  if (colonIndex === -1) {
    return Number(timeString);
  }
  const hours = parseInt(timeString.slice(0, colonIndex), 10);
  const minutes = parseInt(timeString.slice(colonIndex + 1), 10);
  return (hours * 60 + minutes) * 60;
};

export const isToday = (value) => {
  if (!value) {
    return false;
  }
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (typeof value === "string") {
    return value === todayStr;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return s === todayStr;
  }
  if (value instanceof Date) {
    const s = `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    return s === todayStr;
  }
  return false;
};

/**
 * Returns the current time as "HH:MM", with an optional minute offset.
 *
 * @param {number} [offsetMinutes=0] - Minutes to add (negative = subtract).
 *   E.g. getNowHours(-5) returns "now minus 5 minutes".
 *
 * @example
 * getNowHours()       // "14:30"
 * getNowHours(-5)     // "14:25"
 */
export const getNowHours = (offsetMinutes = 0) => {
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes() + offsetMinutes;
  const clamped =
    totalMinutes < 0
      ? 0
      : totalMinutes > 23 * 60 + 59
        ? 23 * 60 + 59
        : totalMinutes;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Returns the current time rounded up to the nearest step boundary,
 * with an optional minute offset applied first.
 *
 * This is useful to compute a step-aligned `min` for a time picker:
 * passing it ensures the first available slot is always on a step boundary.
 *
 * @param {number} stepMinutes - Step size in minutes (e.g. 30).
 * @param {number} [offsetMinutes=0] - Minutes to add before rounding (negative = subtract).
 *
 * @example
 * // At 9:32, step 30, offset -5 → raw = 9:27 → ceil to 30 → "09:30"
 * // At 9:38, step 30, offset -5 → raw = 9:33 → ceil to 30 → "10:00"
 * getNowHoursRoundedToStep(30, -5)
 */
export const getNowHoursRoundedToStep = (stepMinutes, offsetMinutes = 0) => {
  const now = new Date();
  const totalMinutes = now.getHours() * 60 + now.getMinutes() + offsetMinutes;
  const aligned = Math.ceil(totalMinutes / stepMinutes) * stepMinutes;
  const clamped =
    aligned < 0 ? 0 : aligned > 23 * 60 + 59 ? 23 * 60 + 59 : aligned;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * "HH:MM" and its two numbers, in both directions — what any control made of an
 * hour beside a minute (fields, wheels) aggregates to and is placed from. Held
 * as numbers, written on two digits: how they are shown is each control's own
 * business.
 */
export const parseTimeParts = (time) => {
  if (typeof time !== "string") {
    return null;
  }
  const match = /^(\d{1,2}):(\d{1,2})/.exec(time);
  if (!match) {
    return null;
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

// Half a time is not a time: a control holding one of the two and nothing in
// the other has no value at all, and a form has nothing to send about it.
export const formatTimeParts = (hour, minute) => {
  if (
    hour === "" ||
    hour === undefined ||
    minute === "" ||
    minute === undefined
  ) {
    return undefined;
  }
  return `${padTwo(hour)}:${padTwo(minute)}`;
};

export const minutesFromTime = (time) => {
  const parts = parseTimeParts(time);
  if (!parts) {
    return null;
  }
  return parts.hour * 60 + parts.minute;
};

export const timeFromMinutes = (minutes) => {
  const inDay =
    ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${padTwo(Math.floor(inDay / 60))}:${padTwo(inDay % 60)}`;
};

const MINUTES_PER_DAY = 24 * 60;

const padTwo = (value) => String(value).padStart(2, "0");
