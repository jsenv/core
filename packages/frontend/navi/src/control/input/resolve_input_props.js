import { parseDurationToSeconds } from "@jsenv/validity";

import { parseStepToSeconds } from "../picker/time_helpers.js";

// Conceptual number types: define defaults and map to native type="number".
// The `data-navi-input-type` attribute is set so constraint messages can use
// domain-specific wording instead of the generic "Ce nombre doit être...".
const NAVI_TYPE_DEFAULTS = {
  navi_time: {
    "type": "time",
    "navi-input-type": "time",
    "min": 0,
    "max": 24 * 3600 - 1,
    "step": 1,
  },
  navi_hour: {
    "type": "navi_number",
    "navi-input-type": "hour",
    "min": 0,
    "max": 23,
    "step": 1,
  },
  navi_minute: {
    "type": "navi_number",
    "navi-input-type": "minute",
    "min": 0,
    "max": 59,
    "step": 1,
  },
  navi_second: {
    "type": "navi_number",
    "navi-input-type": "second",
    "min": 0,
    "max": 59,
    "step": 1,
  },
  navi_percentage: {
    "type": "navi_number",
    "navi-input-type": "percentage",
    "min": 0,
    "max": 100,
    "step": 1,
  },
  navi_number: {
    type: "text",
    inputMode: "numeric",
    autoCorrect: "off",
    spellcheck: "false",
    autoComplete: "off",
  },
};

/**
 * resolveInputProps — normalizes input-related props that are shared across
 * `<Picker>`, `<Input>` (textual) and `<Range>`. Mutates the props object in place.
 *
 * Normalization is applied recursively: a navi type may resolve to another navi
 * type (e.g. `navi_hour` → `navi_number` → `text`), and each step applies its
 * own formatters and defaults before moving to the next.
 *
 * Steps applied for each type:
 * 1. Record the original navi type in `props["navi-input-type"]` (first call only).
 * 2. Apply defaults for the current type (min, max, step, and any other props),
 *    only when the prop is not already set.
 * 3. Apply min/max formatters (e.g. HH:MM string → number for duration types,
 *    Date → formatted string for date/time types).
 * 4. Apply step formatter (same conversion rules).
 * 5. Remap `props.type` to the target type defined by the current type's defaults,
 *    then recurse.
 *
 * Supported navi types and their targets:
 * - `navi_hour`       → `navi_number`  (HH:MM strings accepted for min/max/step → hours as float)
 * - `navi_minute`     → `navi_number`  (HH:MM strings → total minutes as integer)
 * - `navi_second`     → `navi_number`  (HH:MM strings → total seconds as integer)
 * - `navi_percentage` → `navi_number`  (0–100, step 1)
 * - `navi_number`     → `text`         (inputMode="numeric", no spin buttons implied)
 * - `navi_time`       → `time`         (step in seconds)
 *
 * Standard HTML input types with formatters:
 * - `date`, `month`, `week`, `time`, `datetime-local`, `datetime`:
 *   min/max accept `Date` instances or timestamps and are converted to the
 *   string format expected by the native input.
 * - `time`, `datetime-local`, `datetime`:
 *   step accepts `"HH:MM"` and is converted to seconds.
 */
export const resolveInputProps = (props) => {
  const currentType = props.type;
  const currentTypeDefaults = NAVI_TYPE_DEFAULTS[currentType];
  if (!currentTypeDefaults) {
    return;
  }
  for (const key of Object.keys(currentTypeDefaults)) {
    if (props[key] === undefined) {
      props[key] = currentTypeDefaults[key];
    }
  }
  // Apply formatters for the original navi type before remapping
  const currentTypeMinMaxFormatter = MIN_MAX_FORMATTER_BY_TYPE[currentType];
  const currentTypeStepFormatter = STEP_FORMATTER_BY_TYPE[currentType];
  if (currentTypeMinMaxFormatter) {
    props.min = currentTypeMinMaxFormatter(props.min);
    props.max = currentTypeMinMaxFormatter(props.max);
  }
  if (currentTypeStepFormatter) {
    props.step = currentTypeStepFormatter(props.step);
  }
  const targetType = currentTypeDefaults.type;
  props.type = targetType;
  resolveInputProps(props);
};

const timeStringToMinutes = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  const seconds = parseDurationToSeconds(value);
  if (seconds !== null) {
    return seconds / 60;
  }
  return value;
};
const timeStringToHours = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  const seconds = parseDurationToSeconds(value);
  if (seconds !== null) {
    return seconds / 3600;
  }
  return value;
};
const timeStringToSeconds = (value) => {
  if (typeof value !== "string") {
    return value;
  }
  const seconds = parseDurationToSeconds(value);
  if (seconds !== null) {
    return seconds;
  }
  return value;
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
