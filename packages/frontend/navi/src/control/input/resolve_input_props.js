import { isSignal } from "../../utils/is_signal.js";
import { CHAR_CLASS_PRESETS } from "../char_guard_presets.js";
import { timeStringToSeconds } from "../picker/time_helpers.js";

// Maps validity type names → navi input type names
const VALIDITY_TYPE_TO_INPUT_TYPE = {
  percentage: "navi_percentage",
};

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
  navi_percentage: {
    "type": "navi_number",
    "navi-input-type": "percentage",
    "min": 0,
    "max": 100,
    "step": 1,
  },
  navi_number: {
    type: "text",
    autoCorrect: "off",
    spellcheck: false,
    autoComplete: "off",
  },
};

/**
 * resolveInputProps — normalizes input-related props that are shared across
 * `<Picker>`, `<Input>` (textual) and `<Range>`. Mutates the props object in place.
 *
 * Normalization is applied recursively: a navi type may resolve to another navi
 * type (e.g. `navi_percentage` → `navi_number` → `text`), and each step applies its
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
  // If value is a stateSignal, pull type/min/max/step defaults from the signal's options.
  // Explicit props take precedence over signal options.
  const valueSignal = props.value;
  if (isSignal(valueSignal) && valueSignal.options) {
    const signalOptions = valueSignal.options;
    for (const key of ["min", "max", "step"]) {
      if (props[key] === undefined && signalOptions[key] !== undefined) {
        props[key] = signalOptions[key];
      }
    }
    if (props.type === undefined && signalOptions.type !== undefined) {
      props.type =
        VALIDITY_TYPE_TO_INPUT_TYPE[signalOptions.type] ?? signalOptions.type;
    }
    // If no explicit defaultValue, snapshot the signal's current default
    // so that resetUIState restores to the original default — not the
    // value the signal had at the time of the last re-render.
    if (!Object.hasOwn(props, "defaultValue")) {
      const defaultVal = signalOptions.getDefaultValue(false);
      if (defaultVal !== undefined) {
        props.defaultValue = defaultVal;
      }
    }
  }

  const currentType = props.type;
  // Apply min/max/step formatters before anything else — this must run even for
  // standard HTML types (date, time, etc.) that have no NAVI_TYPE_DEFAULTS entry.
  const currentTypeMinMaxFormatter = MIN_MAX_FORMATTER_BY_TYPE[currentType];
  const currentTypeStepFormatter = STEP_FORMATTER_BY_TYPE[currentType];
  if (currentTypeMinMaxFormatter) {
    props.min = currentTypeMinMaxFormatter(props.min);
    props.max = currentTypeMinMaxFormatter(props.max);
  }
  if (currentTypeStepFormatter) {
    props.step = currentTypeStepFormatter(props.step);
  }

  // For navi_number: choose inputMode based on whether step/min/max suggest decimals.
  // inputMode="numeric" (integer keyboard) vs "decimal" (keyboard with decimal separator).
  if (currentType === "navi_number") {
    if (props.inputMode === undefined) {
      props.inputMode =
        hasDecimalPlaces(props.step) ||
        hasDecimalPlaces(props.min) ||
        hasDecimalPlaces(props.max)
          ? "decimal"
          : "numeric";
    }
  }

  const { charGuard } = props;
  if (charGuard) {
    if (charGuard === true || charGuard === "auto") {
      // Auto-resolve charGuard from context.
      let charGuardResolved;
      const inputMode = props.inputMode;
      if (inputMode === "numeric") {
        charGuardResolved = "numeric";
      } else if (inputMode === "decimal") {
        charGuardResolved = "decimal";
      } else if (currentType === "tel") {
        charGuardResolved = "tel";
      } else if (currentType === "email") {
        charGuardResolved = "email";
      }
      if (charGuardResolved !== undefined) {
        props.charGuard = charGuardResolved;
      }
    }
    // charGuard is now resolved: derive inputMode from it if not already set.
    if (props.inputMode === undefined && props.charGuard) {
      const autoMode = INPUT_MODE_FROM_CHAR_GUARD[props.charGuard];
      if (autoMode) {
        props.inputMode = autoMode;
      }
    }
    // Build pattern from the resolved charGuard (preset name → class, or raw class passthrough).
    if (props.pattern === undefined && props.charGuard) {
      const charClass = CHAR_CLASS_PRESETS[props.charGuard] ?? props.charGuard;
      props.pattern = `${charClass}*`;
    }
  }

  // Compute maxLength from max when inputMode is numeric/decimal.
  // Done here (after inputMode is set) so controller.props has the resolved value.
  if (
    props.maxLength === undefined &&
    props.max !== undefined &&
    (props.inputMode === "numeric" || props.inputMode === "decimal")
  ) {
    if (props.inputMode === "numeric") {
      const { min, max } = props;
      const canBeNegative = min === undefined ? max < 0 : min < 0;
      const signCharCount = canBeNegative ? 1 : 0;
      const integerDigitCount = String(Math.floor(Math.abs(max))).length;
      props.maxLength = signCharCount + integerDigitCount;
    } else if (props.inputMode === "decimal") {
      const { min, max, step } = props;
      const stepStr = String(step);
      const dotIndex = stepStr.indexOf(".");
      if (dotIndex !== -1) {
        decimalDigits = stepStr.length - dotIndex - 1;
      }
    }
  }

  // Resolve maxLengthGuard boolean/auto → the computed maxLength number.
  if (props.maxLengthGuard === true || props.maxLengthGuard === "auto") {
    props.maxLengthGuard =
      typeof props.maxLength === "number" ? props.maxLength : undefined;
  }

  const currentTypeDefaults = NAVI_TYPE_DEFAULTS[currentType];
  if (!currentTypeDefaults) {
    return;
  }

  for (const key of Object.keys(currentTypeDefaults)) {
    if (props[key] === undefined) {
      props[key] = currentTypeDefaults[key];
    }
  }
  const targetType = currentTypeDefaults.type;
  props.type = targetType;
  resolveInputProps(props);
};

// Presets that imply a specific mobile keyboard inputMode.
const INPUT_MODE_FROM_CHAR_GUARD = {
  numeric: "numeric",
  pin: "numeric",
  card: "numeric",
  tel: "tel",
  decimal: "decimal",
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
  "date": toInputDate,
  "month": toInputMonth,
  "week": toInputWeek,
  "time": toInputTime,
  "datetime-local": toInputDatetime,
  "datetime": toInputDatetime,
};
const STEP_FORMATTER_BY_TYPE = {
  "time": timeStringToSeconds,
  "datetime-local": timeStringToSeconds,
  "datetime": timeStringToSeconds,
};

const hasDecimalPlaces = (value) => {
  if (value === undefined || value === null) {
    return false;
  }
  const num = Number(value);
  return !isNaN(num) && !Number.isInteger(num);
};
