/**
 * Parses a step value into seconds.
 * Accepts:
 *   - number: returned as-is (already in seconds)
 *   - "HH:MM" string: converted to seconds (e.g. "00:30" → 1800, "01:00" → 3600)
 *   - undefined/null: returned as-is
 */
export const parseStepToSeconds = (step) => {
  if (typeof step !== "string") {
    return step;
  }
  const colonIndex = step.indexOf(":");
  if (colonIndex === -1) {
    return Number(step);
  }
  const hours = parseInt(step.slice(0, colonIndex), 10);
  const minutes = parseInt(step.slice(colonIndex + 1), 10);
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
 * Returns the latest of all provided HH:MM time strings as the effective minimum.
 * undefined/null values are ignored.
 *
 * @example
 * minHour(["07:00", isToday(day) ? getNowHours(-5) : undefined])
 */
export const minHour = (times) => {
  let result = null;
  for (const t of times) {
    if (!t) {
      continue;
    }
    if (result === null || t > result) {
      result = t;
    }
  }
  return result;
};
