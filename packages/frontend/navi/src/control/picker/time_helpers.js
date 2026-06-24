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
