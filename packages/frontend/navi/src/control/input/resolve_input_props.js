import { parseStepToSeconds } from "../picker/time_helpers.js";

/**
 * resolveInputProps — normalizes input-related props that are shared across
 * `<Picker>`, `<Input>` (textual) and `<Range>`. Mutates the props object in place.
 *
 * Currently it normalizes:
 * - `min` / `max`: accepts a `Date` instance and converts it to the string
 *   format the native input expects, based on `props.type`. Picker aliases
 *   (`day`, `datetime`) are mapped to their native equivalent (`date`,
 *   `datetime-local`).
 * - `step`: for time-based types (`time`, `datetime-local`/`datetime`)
 *   accepts an `"HH:MM"` string and converts it to seconds.
 */
export const resolveInputProps = (props) => {
  const { type } = props;
  const minMaxFormatter = MIN_MAX_FORMATTER_BY_TYPE[type];
  const stepFormatter = STEP_FORMATTER_BY_TYPE[type];
  if (minMaxFormatter) {
    props.min = minMaxFormatter(props.min);
    props.max = minMaxFormatter(props.max);
  }
  if (stepFormatter) {
    props.step = stepFormatter(props.step);
  }
};

const toInputDay = (value) => {
  if (value === undefined || value === null) {
    return value;
  }
  if (!(value instanceof Date)) {
    return value;
  }
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const toInputMonth = (value) => {
  if (value === undefined || value === null) {
    return value;
  }
  if (!(value instanceof Date)) {
    return value;
  }
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};
const toInputWeek = (value) => {
  if (value === undefined || value === null) {
    return value;
  }
  if (!(value instanceof Date)) {
    return value;
  }
  // ISO week number
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const week =
    Math.round(
      ((d - yearStart) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7,
    ) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};
const toInputTime = (value) => {
  if (value === undefined || value === null) {
    return value;
  }
  if (!(value instanceof Date)) {
    return value;
  }
  const hh = String(value.getHours()).padStart(2, "0");
  const mm = String(value.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};
const toInputDatetime = (value) => {
  if (value === undefined || value === null) {
    return value;
  }
  if (!(value instanceof Date)) {
    return value;
  }
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, "0");
  const dd = String(value.getDate()).padStart(2, "0");
  const hh = String(value.getHours()).padStart(2, "0");
  const min = String(value.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const MIN_MAX_FORMATTER_BY_TYPE = {
  "date": toInputDay,
  "day": toInputDay,
  "month": toInputMonth,
  "week": toInputWeek,
  "time": toInputTime,
  "datetime-local": toInputDatetime,
  "datetime": toInputDatetime,
};

const STEP_FORMATTER_BY_TYPE = {
  "time": parseStepToSeconds,
  "datetime-local": parseStepToSeconds,
  "datetime": parseStepToSeconds,
};
