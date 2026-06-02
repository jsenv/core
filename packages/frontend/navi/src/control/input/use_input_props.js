import { parseStepToSeconds } from "../picker/time_helpers.js";

/**
 * useInputProps — normalizes input-related props that are shared across
 * `<Picker>`, `<Input>` (textual) and `<Range>`.
 *
 * Currently it normalizes:
 * - `min` / `max`: accepts a `Date` instance and converts it to the string
 *   format the native input expects, based on `props.type`. Picker aliases
 *   (`day`, `datetime`) are mapped to their native equivalent (`date`,
 *   `datetime-local`).
 * - `step`: for time-based types (`time`, `datetime-local`/`datetime`)
 *   accepts an `"HH:MM"` string and converts it to seconds.
 *
 * The function is a plain (non-hook) helper. It is idempotent: passing
 * already-normalized values returns them unchanged.
 */
export const useInputProps = (props) => {
  const { type } = props;
  const formatter = TYPE_TO_DATE_FORMATTER[type];
  const hasTimeStep = TYPES_WITH_TIME_STEP.has(type);
  if (!formatter && !hasTimeStep) {
    return props;
  }
  if (formatter) {
    props.min = resolveDateProp(props.min, formatter);
    props.max = resolveDateProp(props.max, formatter);
  }
  if (hasTimeStep && props.step !== undefined) {
    props.step = parseStepToSeconds(props.step);
  }
  return props;
};

const resolveDateProp = (value, formatter) => {
  if (value === null) {
    return undefined;
  }
  if (value instanceof Date) {
    return formatter(value);
  }
  return value;
};

const toInputDay = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const toInputMonth = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};
const toInputWeek = (date) => {
  // ISO week number
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const week =
    Math.round(
      ((d - yearStart) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7,
    ) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};
const toInputTime = (date) => {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};
const toInputDatetime = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const TYPE_TO_DATE_FORMATTER = {
  "date": toInputDay,
  "day": toInputDay,
  "month": toInputMonth,
  "week": toInputWeek,
  "time": toInputTime,
  "datetime-local": toInputDatetime,
  "datetime": toInputDatetime,
};

const TYPES_WITH_TIME_STEP = new Set(["time", "datetime-local", "datetime"]);
