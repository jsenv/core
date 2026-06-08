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
 * - Navi conceptual number types (`navi_hours`, `navi_minutes`, `navi_seconds`,
 *   `navi_percentage`): converted to `type="number"` with sensible min/max/step
 *   defaults and a `data-navi-input-type` attribute for constraint messages.
 */
export const resolveInputProps = (props) => {
  const naviTypeDefaults = NAVI_NUMBER_TYPE_DEFAULTS[props.type];
  if (naviTypeDefaults) {
    props["navi-input-type"] = props.type;
    // Apply formatters for the original navi type before remapping
    const origMinMaxFormatter = MIN_MAX_FORMATTER_BY_TYPE[props.type];
    const origStepFormatter = STEP_FORMATTER_BY_TYPE[props.type];
    if (origMinMaxFormatter) {
      props.min = origMinMaxFormatter(props.min);
      props.max = origMinMaxFormatter(props.max);
    }
    if (origStepFormatter) {
      props.step = origStepFormatter(props.step);
    }
    props.type = naviTypeDefaults.type;
    if (props.min === undefined) {
      props.min = naviTypeDefaults.min;
    }
    if (props.max === undefined) {
      props.max = naviTypeDefaults.max;
    }
    if (props.step === undefined) {
      props.step = naviTypeDefaults.step;
    }
  }
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

// Conceptual number types: define defaults and map to native type="number".
// The `data-navi-input-type` attribute is set so constraint messages can use
// domain-specific wording instead of the generic "Ce nombre doit être...".
const NAVI_NUMBER_TYPE_DEFAULTS = {
  navi_time: { type: "time", min: 0, max: 24 * 3600 - 1, step: 1 },
  navi_hour: { type: "number", min: 0, max: 23, step: 1 },
  navi_minute: { type: "number", min: 0, max: 59, step: 1 },
  navi_second: { type: "number", min: 0, max: 59, step: 1 },
  navi_percentage: { type: "number", min: 0, max: 100, step: 1 },
};

// HH:MM → number converters for duration navi types.
// Used in MIN_MAX_FORMATTER_BY_TYPE and STEP_FORMATTER_BY_TYPE before type remapping.
const timeStringToMinutes = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  const m = /^(\d+):(\d{2})$/.exec(value);
  if (!m) {
    return value;
  }
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};
const timeStringToHours = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  const m = /^(\d+):(\d{2})$/.exec(value);
  if (!m) {
    return value;
  }
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
};
const timeStringToSeconds = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  const m = /^(\d+):(\d{2})$/.exec(value);
  if (!m) {
    return value;
  }
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
};

const normalizeToDate = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "number") {
    return new Date(value);
  }
  if (value instanceof Date) {
    return value;
  }
  return null;
};

const toInputDate = (value) => {
  const date = normalizeToDate(value);
  if (!date) {
    return value;
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
const toInputMonth = (value) => {
  const date = normalizeToDate(value);
  if (!date) {
    return value;
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};
const toInputWeek = (value) => {
  const date = normalizeToDate(value);
  if (!date) {
    return value;
  }
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
const toInputTime = (value) => {
  const date = normalizeToDate(value);
  if (!date) {
    return value;
  }
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};
const toInputDatetime = (value) => {
  const date = normalizeToDate(value);
  if (!date) {
    return value;
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

const MIN_MAX_FORMATTER_BY_TYPE = {
  "navi_minute": timeStringToMinutes,
  "navi_hour": timeStringToHours,
  "navi_second": timeStringToSeconds,
  "date": toInputDate,
  "month": toInputMonth,
  "week": toInputWeek,
  "time": toInputTime,
  "datetime-local": toInputDatetime,
  "datetime": toInputDatetime,
};

const STEP_FORMATTER_BY_TYPE = {
  "navi_minute": timeStringToMinutes,
  "navi_hour": timeStringToHours,
  "navi_second": timeStringToSeconds,
  "time": parseStepToSeconds,
  "datetime-local": parseStepToSeconds,
  "datetime": parseStepToSeconds,
};
