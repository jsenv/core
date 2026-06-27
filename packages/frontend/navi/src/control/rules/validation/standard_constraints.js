/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */

import {
  compareTwoDurations,
  durationContainsNaN,
  durationToSeconds,
} from "@jsenv/validity";

import {
  formatDay,
  formatDuration,
  formatMonth,
} from "@jsenv/navi/src/text/format_time.js";
import { langSignal } from "@jsenv/navi/src/text/lang_signal.js";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const REQUIRED_CONSTRAINT = {
  name: "required",
  messageAttribute: "data-required-message",
  check: (field) => {
    const required = field.controlHostProps.required;
    if (!required) {
      return null;
    }
    const controlType = field.controlType;
    const type = field.controlHostProps.type;

    // radio_group controller: check aggregate uiState
    if (controlType === "radio_group") {
      if (field.uiState !== undefined) {
        return null;
      }
      return {
        message: naviI18n("constraint.required.radio"),
        target: field.elementRef.current,
      };
    }
    if (type === "radio") {
      const parent = field.parentUIStateController;
      if (parent) {
        return null; // handled by parent
      }
      // A radio without parent, not supposed to happen
      if (field.uiState !== undefined) {
        return null;
      }
      return {
        message: naviI18n("constraint.required.radio"),
        target: field.elementRef.current,
      };
    }

    // checkbox_group controller: check aggregate uiState array
    if (controlType === "checkbox_group") {
      const uiState = field.uiState;
      if (uiState.length > 0) {
        return null;
      }
      return {
        message: naviI18n("constraint.required.checkbox_group"),
        target: field.elementRef.current,
      };
    }
    if (type === "checkbox") {
      const parent = field.parentUIStateController;
      if (parent.controlType === "checkbox_group") {
        // handled by parent
        return null;
      }
      if (field.uiState !== undefined) {
        return null;
      }
      return naviI18n("constraint.required.checkbox");
    }

    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (valueAsString) {
      return null;
    }

    if (type === "password") {
      return naviI18n("constraint.required.password");
    }
    if (type === "email") {
      return naviI18n("constraint.required.email");
    }
    if (type === "color") {
      return naviI18n("constraint.required.color");
    }
    if (type === "date") {
      return naviI18n("constraint.required.date");
    }
    if (type === "month") {
      return naviI18n("constraint.required.month");
    }
    if (type === "week") {
      return naviI18n("constraint.required.week");
    }
    if (type === "time") {
      return naviI18n("constraint.required.time");
    }
    const inputMode = field.controlHostProps.inputMode;
    if (
      type === "number" ||
      inputMode === "numeric" ||
      inputMode === "decimal"
    ) {
      return naviI18n("constraint.required.number");
    }
    if (type === "datetime-local") {
      return naviI18n("constraint.required.datetime");
    }
    if (type === "file") {
      const multiple = field.controlHostProps.multiple;
      return multiple
        ? naviI18n("constraint.required.file.multiple")
        : naviI18n("constraint.required.file");
    }
    return naviI18n("constraint.required.default");
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("required");

export const PATTERN_CONSTRAINT = {
  name: "pattern",
  messageAttribute: "data-pattern-message",
  check: (field) => {
    const pattern = field.controlHostProps.pattern;
    if (!pattern) {
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (!valueAsString) {
      return null;
    }
    const regex = new RegExp(`^(?:${pattern})$`);
    if (regex.test(valueAsString)) {
      return null;
    }

    const type = field.controlHostProps.type;
    if (type === "email") {
      return naviI18n("constraint.pattern.email");
    }
    if (type === "password") {
      return naviI18n("constraint.pattern.password");
    }
    return naviI18n("constraint.pattern.default");
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("pattern");

// https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/email#validation
const emailregex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
export const TYPE_EMAIL_CONSTRAINT = {
  name: "type_email",
  messageAttribute: "data-type-message",
  check: (field) => {
    const type = field.controlHostProps.type;
    if (type !== "email") {
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (!valueAsString) {
      return null;
    }
    if (emailregex.test(valueAsString)) {
      return null;
    }

    if (!valueAsString.includes("@")) {
      return naviI18n("constraint.type.email.at", { value: valueAsString });
    }
    return naviI18n("constraint.type.email.invalid");
  },
};

export const MIN_LENGTH_CONSTRAINT = {
  name: "min_length",
  messageAttribute: "data-min-length-message",
  check: (field) => {
    const type = field.controlHostProps.type ?? "text";
    const isInput =
      field.controlType === "input" || field.controlType === "picker";
    const isTextarea =
      field.controlHostProps.as === "textarea" ||
      field.controlType === "textarea";
    if (isInput) {
      if (!INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET.has(type)) {
        return null;
      }
    } else if (!isTextarea) {
      return null;
    }
    const minLength = field.controlHostProps.minLength;
    if (minLength === undefined) {
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (!valueAsString) {
      return null;
    }
    const valueLength = valueAsString.length;
    if (valueLength >= minLength) {
      return null;
    }

    if (valueLength === 1) {
      const singularKey = (() => {
        if (type === "email") {
          return `constraint.min_length.singular.email`;
        }
        if (type === "password") {
          return `constraint.min_length.singular.password`;
        }
        return `constraint.min_length.singular.default`;
      })();
      return naviI18n(singularKey, {
        min: String(minLength),
      });
    }
    const pluralKey = (() => {
      if (type === "email") {
        return `constraint.min_length.plural.email`;
      }
      if (type === "password") {
        return `constraint.min_length.plural.password`;
      }
      return `constraint.min_length.plural.default`;
    })();
    return naviI18n(pluralKey, {
      min: String(minLength),
      count: String(valueLength),
    });
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("minLength");
const INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
]);

export const MAX_LENGTH_CONSTRAINT = {
  name: "max_length",
  messageAttribute: "data-max-length-message",
  check: (field) => {
    const type = field.controlHostProps.type ?? "text";
    const isInput =
      field.controlType === "input" || field.controlType === "picker";
    const isTextarea =
      field.controlHostProps.as === "textarea" ||
      field.controlType === "textarea";
    if (isInput) {
      if (!INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET.has(type)) {
        return null;
      }
    } else if (!isTextarea) {
      return null;
    }
    const maxLength =
      field.controlHostProps.maxLength ?? field.props?.maxLengthGuard;
    if (maxLength === undefined) {
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (!valueAsString) {
      return null;
    }
    const valueLength = valueAsString.length;
    if (valueLength <= maxLength) {
      return null;
    }

    const maxLengthKey = (() => {
      if (type === "email") {
        return `constraint.max_length.email`;
      }
      if (type === "password") {
        return `constraint.max_length.password`;
      }
      return `constraint.max_length.default`;
    })();
    return naviI18n(maxLengthKey, {
      max: String(maxLength),
      count: String(valueLength),
    });
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("maxLength");
const INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET = new Set(
  INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET,
);

export const TYPE_NUMBER_CONSTRAINT = {
  name: "type_number",
  messageAttribute: "data-type-message",
  check: (field) => {
    if (field.controlType !== "input" && field.controlType !== "picker") {
      return null;
    }
    const type = field.controlHostProps.type;
    const inputMode = field.controlHostProps.inputMode;
    const isNumber =
      type === "number" || inputMode === "numeric" || inputMode === "decimal";
    if (!isNumber) {
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (!valueAsString) {
      return null;
    }
    const numericValue = Number(valueAsString);
    if (!isNaN(numericValue)) {
      return null;
    }

    const naviType = field.controlHostProps["navi-input-type"];
    if (naviType === "hour") {
      return naviI18n(`constraint.type.hour.default`);
    }
    if (naviType === "minute") {
      return naviI18n(`constraint.type.minute.default`);
    }
    if (naviType === "second") {
      return naviI18n(`constraint.type.second.default`);
    }
    if (naviType === "percentage") {
      return naviI18n(`constraint.type.percentage.default`);
    }
    return naviI18n(`constraint.type.number.default`);
  },
};

// ISO date strings (YYYY-MM-DD, YYYY-MM, YYYY-Www, YYYY-MM-DDTHH:MM) are
// zero-padded big-endian, so lexicographic comparison is equivalent to
// chronological comparison — no need to parse into Date objects.
const DATE_INPUT_TYPE_SET = new Set([
  "date",
  "month",
  "week",
  "datetime-local",
]);

export const MIN_CONSTRAINT = {
  name: "min",
  messageAttribute: "data-min-message",
  check: (field) => {
    // Sub-inputs inside a duration_group: min/max is validated at the group level, not per-field.
    // Per-field min/max attributes are kept for arrow-key navigation bounds only.
    if (field.parentUIStateController?.controlType === "duration_group") {
      return null;
    }
    if (field.controlType === "duration_group") {
      const min = field.controlHostProps.min;
      if (min === undefined || min === null) {
        return null;
      }
      if (durationContainsNaN(field.uiState)) {
        return null;
      }
      const cmp = compareTwoDurations(field.uiState, min);
      if (cmp === null || cmp >= 0) {
        return null;
      }

      return naviI18n("constraint.min.duration.default", {
        min: formatDuration(min),
      });
    }
    if (field.controlType !== "input" && field.controlType !== "picker") {
      return null;
    }
    const minString = field.controlHostProps.min;
    if (!minString) {
      return null;
    }
    const type = field.controlHostProps.type;
    const inputMode = field.controlHostProps.inputMode;
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (!valueAsString) {
      return null;
    }
    const isNumber =
      type === "number" || inputMode === "numeric" || inputMode === "decimal";
    if (isNumber) {
      const minNumber = parseFloat(minString);
      if (isNaN(minNumber)) {
        return null;
      }
      const numericValue = Number(valueAsString);
      if (isNaN(numericValue)) {
        return null;
      }
      if (numericValue < minNumber) {
        const naviInputType = field.controlHostProps["navi-input-type"];
        if (naviInputType === "hour") {
          return naviI18n(`constraint.min.hour.default`, {
            min: minString,
          });
        }
        if (naviInputType === "minute") {
          return naviI18n(`constraint.min.minute.default`, {
            min: minString,
          });
        }
        if (naviInputType === "second") {
          return naviI18n(`constraint.min.second.default`, {
            min: minString,
          });
        }
        if (naviInputType === "percentage") {
          return naviI18n(`constraint.min.percentage.default`, {
            min: minString,
          });
        }
        return naviI18n(`constraint.min.number.default`, {
          min: minString,
        });
      }
      return null;
    }
    if (type === "time") {
      const [minHours, minMinutes] = minString.split(":").map(Number);
      const [hours, minutes] = valueAsString.split(":").map(Number);
      if (hours < minHours || (hours === minHours && minutes < minMinutes)) {
        return naviI18n("constraint.min.time.default", {
          min: minString,
        });
      }
      return null;
    }
    // range inputs enforce boundaries via their UI and browser clamping for programmatic updates
    // so they never need a min/max validation message.
    if (DATE_INPUT_TYPE_SET.has(type)) {
      if (valueAsString < minString) {
        const todayIso = getTodayIso(type);
        if (minString === todayIso) {
          return naviI18n("constraint.min.date.today.default");
        }
        return naviI18n("constraint.min.date.default", {
          min: formatDateIso(minString, type),
        });
      }
      return null;
    }
    return null;
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("min");

export const MAX_CONSTRAINT = {
  name: "max",
  messageAttribute: "data-max-message",
  check: (field) => {
    // Sub-inputs inside a duration_group: min/max is validated at the group level, not per-field.
    // Per-field min/max attributes are kept for arrow-key navigation bounds only.
    if (field.parentUIStateController?.controlType === "duration_group") {
      return null;
    }
    if (field.controlType === "duration_group") {
      const max = field.controlHostProps.max;
      if (max === undefined || max === null) {
        return null;
      }
      if (durationContainsNaN(field.uiState)) {
        return null;
      }
      const cmp = compareTwoDurations(field.uiState, max);
      if (cmp === null || cmp <= 0) {
        return null;
      }

      return naviI18n("constraint.max.duration.default", {
        max: formatDuration(max),
      });
    }
    if (field.controlType !== "input" && field.controlType !== "picker") {
      return null;
    }
    const maxString = field.controlHostProps.max;
    if (!maxString) {
      return null;
    }
    const type = field.controlHostProps.type;
    const inputMode = field.controlHostProps.inputMode;
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (!valueAsString) {
      return null;
    }
    const isNumber =
      type === "number" || inputMode === "numeric" || inputMode === "decimal";
    if (isNumber) {
      const maxNumber = parseFloat(maxString);
      if (isNaN(maxNumber)) {
        return null;
      }
      const numericValue = Number(valueAsString);
      if (isNaN(numericValue)) {
        return null;
      }
      if (numericValue <= maxNumber) {
        return null;
      }

      const naviInputType = field.controlHostProps["navi-input-type"];
      if (naviInputType === "hour") {
        return naviI18n(`constraint.max.hour.default`, {
          max: maxString,
        });
      }
      if (naviInputType === "minute") {
        return naviI18n(`constraint.max.minute.default`, {
          max: maxString,
        });
      }
      if (naviInputType === "second") {
        return naviI18n(`constraint.max.second.default`, {
          max: maxString,
        });
      }
      if (naviInputType === "percentage") {
        return naviI18n(`constraint.max.percentage.default`, {
          max: maxString,
        });
      }
      return naviI18n(`constraint.max.number.default`, {
        max: maxString,
      });
    }
    if (type === "time") {
      const [maxHours, maxMinutes] = maxString.split(":").map(Number);
      const [hours, minutes] = valueAsString.split(":").map(Number);
      if (hours > maxHours || (hours === maxHours && minutes > maxMinutes)) {
        return naviI18n("constraint.max.time.default", {
          max: maxString,
        });
      }
      return null;
    }
    if (DATE_INPUT_TYPE_SET.has(type)) {
      if (valueAsString <= maxString) {
        return null;
      }

      const todayIso = getTodayIso(type);
      if (maxString === todayIso) {
        return naviI18n("constraint.max.date.today.default");
      }
      return naviI18n("constraint.max.date.default", {
        max: formatDateIso(maxString, type),
      });
    }
    return null;
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("max");

const STEP_SUPPORTED_TYPE_SET = new Set([
  "number",
  "time",
  "date",
  "month",
  "week",
  "datetime-local",
]);

export const STEP_CONSTRAINT = {
  name: "step",
  messageAttribute: "data-step-message",
  check: (field) => {
    if (field.controlType === "duration_group") {
      const step = field.controlHostProps.step;
      if (!step) {
        return null;
      }
      if (durationContainsNaN(field.uiState)) {
        return null;
      }
      const min = field.controlHostProps.min ?? 0;
      const valueSeconds = durationToSeconds(field.uiState);
      if (valueSeconds === null) {
        return null;
      }
      const stepSeconds =
        typeof step === "number" ? step : durationToSeconds(step);
      const minSeconds =
        typeof min === "number" ? min : (durationToSeconds(min) ?? 0);
      if (stepSeconds === null) {
        return null;
      }

      const remainder =
        (((valueSeconds - minSeconds) % stepSeconds) + stepSeconds) %
        stepSeconds;
      const epsilon = stepSeconds * 1e-9;
      if (remainder <= epsilon || remainder >= stepSeconds - epsilon) {
        return null;
      }

      const before = valueSeconds - remainder;
      const after = before + stepSeconds;
      return naviI18n("constraint.step.duration.default", {
        step: formatDuration(stepSeconds),
        before: formatDuration(before),
        after: formatDuration(after),
      });
    }
    if (field.controlType !== "input" && field.controlType !== "picker") {
      return null;
    }
    const type = field.controlHostProps.type;
    const inputMode = field.controlHostProps.inputMode;
    const isNumericText =
      type === "text" && (inputMode === "numeric" || inputMode === "decimal");
    if (!isNumericText && !STEP_SUPPORTED_TYPE_SET.has(type)) {
      return null;
    }
    const stepRaw = field.controlHostProps.step;
    if (!stepRaw || stepRaw === "any") {
      return null;
    }
    const stepString = String(stepRaw);
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (!valueAsString) {
      return null;
    }
    const minString = field.controlHostProps.min;
    const isNumber = type === "number" || isNumericText;
    if (isNumber) {
      const step = parseFloat(stepString);
      const base = minString ? parseFloat(minString) : 0;
      const numericValue = Number(valueAsString);
      if (isNaN(numericValue)) {
        return null;
      }
      const remainder = (((numericValue - base) % step) + step) % step;
      // Use a small epsilon to handle floating-point imprecision
      const epsilon = step * 1e-9;
      const hasMismatch = remainder > epsilon && remainder < step - epsilon;
      if (!hasMismatch) {
        return null;
      }
      const before = base + Math.floor((numericValue - base) / step) * step;
      const after = before + step;
      const decimals = (stepString.split(".")[1] || "").length;
      const context = (() => {
        const naviInputType = field.controlHostProps["navi-input-type"];
        if (naviInputType === "hour") {
          return `hour`;
        }
        if (naviInputType === "minute") {
          return `minute`;
        }
        if (naviInputType === "second") {
          return `second`;
        }
        if (naviInputType === "percentage") {
          return `percentage`;
        }
        return `number`;
      })();
      return naviI18n(`constraint.step.${context}.default`, {
        step: stepString,
        before: before.toFixed(decimals),
        after: after.toFixed(decimals),
      });
    }
    if (type === "time") {
      const stepSeconds = parseFloat(stepString);
      if (!isNaN(stepSeconds)) {
        const stepMs = stepSeconds * 1000;
        const valueMs = timeStringToMs(valueAsString);
        const baseMs = minString ? timeStringToMs(minString) : 0;
        const remainder = (((valueMs - baseMs) % stepMs) + stepMs) % stepMs;
        if (remainder === 0) {
          return null;
        }
        const beforeMs = valueMs - remainder;
        const afterMs = beforeMs + stepMs;
        const showSeconds = stepSeconds % 60 !== 0;
        const before = formatMsToTime(beforeMs, showSeconds);
        const after = formatMsToTime(afterMs, showSeconds);
        if (stepSeconds % 3600 === 0) {
          return naviI18n("constraint.step.time.hour", {
            step: String(stepSeconds / 3600),
            before,
            after,
          });
        }
        if (stepSeconds % 60 === 0) {
          return naviI18n("constraint.step.time.minute", {
            step: String(stepSeconds / 60),
            before,
            after,
          });
        }
        return naviI18n("constraint.step.time.second", {
          step: stepString,
          before,
          after,
        });
      }
    }
    {
      const step = parseInt(stepString, 10);
      const baseDate = minString
        ? new Date(`${minString}T00:00:00`)
        : new Date(0);
      const valueDate = new Date(`${valueAsString}T00:00:00`);
      const diffDays = Math.round((valueDate - baseDate) / 86400000);
      if (diffDays % step === 0) {
        return null;
      }
      const beforeDays = Math.floor(diffDays / step) * step;
      const afterDays = beforeDays + step;
      const beforeDate = new Date(baseDate);
      beforeDate.setDate(beforeDate.getDate() + beforeDays);
      const afterDate = new Date(baseDate);
      afterDate.setDate(afterDate.getDate() + afterDays);
      return naviI18n("constraint.step.date.default", {
        step: stepString,
        before: formatDateIso(beforeDate.toISOString().slice(0, 10), type),
        after: formatDateIso(afterDate.toISOString().slice(0, 10), type),
      });
    }
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("step");

const timeStringToMs = (timeString) => {
  const parts = timeString.split(":").map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return (h * 3600 + m * 60 + s) * 1000;
};

const formatMsToTime = (ms, showSeconds) => {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  if (!showSeconds) {
    return `${hh}:${mm}`;
  }
  const ss = String(s).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const getTodayIso = (inputType) => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  if (inputType === "month") {
    return `${yyyy}-${mm}`;
  }
  return `${yyyy}-${mm}-${dd}`;
};

const formatDateIso = (iso, inputType) => {
  const locale = langSignal.value;
  if (inputType === "month") {
    const date = new Date(`${iso}-01T00:00:00`);
    return formatMonth(date, locale);
  }
  // date, week, datetime-local: extract YYYY-MM-DD part and parse as local date
  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (!isoMatch) {
    return iso;
  }
  const datePart = isoMatch[1];
  const date = new Date(`${datePart}T00:00:00`);
  if (isNaN(date.getTime())) {
    return iso;
  }
  return formatDay(date, locale, { long: true });
};
