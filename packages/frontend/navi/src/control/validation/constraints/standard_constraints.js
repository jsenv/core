/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */

import { formatDay, formatMonth } from "@jsenv/navi/src/text/format_time.js";
import { langSignal } from "@jsenv/navi/src/text/lang_signal.js";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";
import {
  fieldTypeSuffix,
  getConstraintValue,
} from "./constraint_message_util.js";

// this constraint is not really a native constraint and browser just not let this happen at all
// in our case it's just here in case some code is wrongly calling "requestAction" or "checkValidity" on a disabled element
export const DISABLED_CONSTRAINT = {
  name: "disabled",
  messageAttribute: "data-disabled-message",
  check: (field) => {
    const disabled = field.props?.disabled ?? field.disabled;
    if (disabled) {
      return naviI18n(`constraint.disabled.${fieldTypeSuffix(field)}`);
    }
    return null;
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("disabled");
CONSTRAINT_ATTRIBUTE_SET.add("data-disabled");

export const REQUIRED_CONSTRAINT = {
  name: "required",
  messageAttribute: "data-required-message",
  check: (field, { skipRequired }) => {
    const required = field.props?.required ?? field.required;
    if (!required) {
      return null;
    }
    if (skipRequired) {
      return null;
    }
    const controlType = field.controlType;
    const type = field.props?.type ?? field.type ?? "";

    // radio_group controller: check aggregate uiState
    if (controlType === "radio_group") {
      if (field.uiState == null) {
        return {
          message: naviI18n("constraint.required.radio"),
          target: field.elementRef?.current,
        };
      }
      return null;
    }
    // checkbox_group controller: check aggregate uiState array
    if (controlType === "checkbox_group") {
      const uiState = field.uiState;
      if (!uiState || uiState.length === 0) {
        return {
          message: naviI18n("constraint.required.checkbox_group"),
          target: field.elementRef?.current,
        };
      }
      return null;
    }

    if (type === "checkbox") {
      // Individual checkbox controller
      if (field.props !== undefined) {
        if (!field.uiState) {
          return naviI18n("constraint.required.checkbox");
        }
        return null;
      }
      // Legacy DOM element
      const name = field.name;
      if (name) {
        const checkboxGroupContainer = field.form || document;
        const checkboxSelector = `input[type="checkbox"][name="${CSS.escape(name)}"]`;
        const checkboxArray =
          checkboxGroupContainer.querySelectorAll(checkboxSelector);
        if (checkboxArray.length > 1) {
          for (const checkbox of checkboxArray) {
            if (checkbox.checked) {
              return null;
            }
          }
          return {
            message: naviI18n("constraint.required.checkbox_group"),
            target: field.closest("fieldset") || undefined,
          };
        }
      }
      if (!field.checked) {
        return naviI18n("constraint.required.checkbox");
      }
      return null;
    }

    if (type === "radio") {
      // Individual radio controller
      if (field.props !== undefined) {
        const parent = field.parentUIStateController;
        if (parent) {
          const siblings = parent.getChildControllers?.() ?? [];
          const radiosWithSameName = siblings.filter(
            (c) =>
              c.controlType === "input" &&
              c.props?.type === "radio" &&
              c.name === field.name,
          );
          if (radiosWithSameName.some((c) => c.uiState === true)) {
            return null;
          }
        } else if (!field.uiState) {
          return naviI18n("constraint.required.radio");
        }
        return {
          message: naviI18n("constraint.required.radio"),
          target: field.elementRef?.current,
        };
      }
      // Legacy DOM element
      const name = field.name;
      if (name) {
        const radioGroupContainer = field.form || document;
        const radioSelector = `input[type="radio"][name="${CSS.escape(name)}"]`;
        const radiosWithSameName =
          radioGroupContainer.querySelectorAll(radioSelector);
        for (const radio of radiosWithSameName) {
          if (radio.checked) {
            return null;
          }
        }
        return {
          message: naviI18n("constraint.required.radio"),
          target: field.closest("fieldset") || undefined,
        };
      }
      if (!field.checked) {
        return naviI18n("constraint.required.radio");
      }
      return null;
    }

    if (type === "color") {
      const uiState = field.props !== undefined ? field.uiState : field.value;
      if (uiState == null || uiState === "") {
        return naviI18n("constraint.required.color");
      }
      return null;
    }

    const value = getConstraintValue(field);
    if (value) {
      return null;
    }
    const sameAs =
      field.props?.["data-same-as"] ?? field.getAttribute?.("data-same-as");
    if (type === "password") {
      return sameAs
        ? naviI18n("constraint.required.password.confirm")
        : naviI18n("constraint.required.password");
    }
    if (type === "email") {
      return sameAs
        ? naviI18n("constraint.required.email.confirm")
        : naviI18n("constraint.required.email");
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
    const inputMode = field.props?.inputMode ?? field.inputMode ?? "";
    if (type === "number" || inputMode === "numeric") {
      return naviI18n("constraint.required.number");
    }
    if (type === "datetime-local") {
      return naviI18n("constraint.required.datetime");
    }
    if (type === "file") {
      const multiple = field.props?.multiple ?? field.multiple;
      return multiple
        ? naviI18n("constraint.required.file.multiple")
        : naviI18n("constraint.required.file");
    }
    if (sameAs) {
      return naviI18n("constraint.required.confirm");
    }
    return naviI18n("constraint.required.default");
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("required");

export const PATTERN_CONSTRAINT = {
  name: "pattern",
  messageAttribute: "data-pattern-message",
  check: (field) => {
    const pattern = field.props?.pattern ?? field.pattern ?? "";
    if (!pattern) {
      return null;
    }
    const value = getConstraintValue(field);
    const required = field.props?.required ?? field.required;
    if (!value && !required) {
      return null;
    }
    const regex = new RegExp(`^(?:${pattern})$`);
    if (regex.test(value)) {
      return null;
    }
    const type = field.props?.type ?? field.type ?? "";
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
    const type = field.props?.type ?? field.type ?? "";
    if (type !== "email") {
      return null;
    }
    const value = getConstraintValue(field);
    if (!value) {
      return null;
    }
    if (!value.includes("@")) {
      return naviI18n("constraint.type.email.at", { value });
    }
    if (!emailregex.test(value)) {
      return naviI18n("constraint.type.email.invalid");
    }
    return null;
  },
};

export const MIN_LENGTH_CONSTRAINT = {
  name: "min_length",
  messageAttribute: "data-min-length-message",
  check: (field) => {
    const controlType = field.controlType ?? "";
    const type = field.props?.type ?? field.type ?? "text";
    const isInput = controlType === "input" || field.tagName === "INPUT";
    const isTextarea =
      field.props?.as === "textarea" ||
      controlType === "textarea" ||
      field.tagName === "TEXTAREA";
    if (isInput) {
      if (!INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET.has(type)) {
        return null;
      }
    } else if (!isTextarea) {
      return null;
    }
    const minLength = field.props?.minLength ?? field.minLength;
    if (minLength == null || minLength === -1) {
      return null;
    }
    const value = getConstraintValue(field);
    if (!value) {
      return null;
    }
    const valueLength = value.length;
    if (valueLength >= minLength) {
      return null;
    }
    if (valueLength === 1) {
      return naviI18n(
        `constraint.min_length.singular.${fieldTypeSuffix(field)}`,
        {
          min: String(minLength),
        },
      );
    }
    return naviI18n(`constraint.min_length.plural.${fieldTypeSuffix(field)}`, {
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
    const controlType = field.controlType ?? "";
    const type = field.props?.type ?? field.type ?? "text";
    const isInput = controlType === "input" || field.tagName === "INPUT";
    const isTextarea =
      field.props?.as === "textarea" ||
      controlType === "textarea" ||
      field.tagName === "TEXTAREA";
    if (isInput) {
      if (!INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET.has(type)) {
        return null;
      }
    } else if (!isTextarea) {
      return null;
    }
    const maxLength = field.props?.maxLength ?? field.maxLength;
    if (maxLength == null || maxLength === -1) {
      return null;
    }
    const value = getConstraintValue(field);
    const valueLength = value.length;
    if (valueLength <= maxLength) {
      return null;
    }
    return naviI18n(`constraint.max_length.${fieldTypeSuffix(field)}`, {
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
    const isInput = field.controlType === "input" || field.tagName === "INPUT";
    if (!isInput) {
      return null;
    }
    const type = field.props?.type ?? field.type ?? "";
    const inputMode = field.props?.inputMode ?? field.inputMode ?? "";
    const isNumber = type === "number" || inputMode === "numeric";
    if (!isNumber) {
      return null;
    }
    const value = getConstraintValue(field);
    if (!value) {
      return null;
    }
    const numericValue = Number(value);
    if (!isNaN(numericValue)) {
      return null;
    }
    const naviInputType =
      field.props?.["navi-input-type"] ??
      field.getAttribute?.("navi-input-type");
    return naviI18n(`constraint.type.${naviInputType || "number"}.default`);
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
    const isInput = field.controlType === "input" || field.tagName === "INPUT";
    if (!isInput) {
      return null;
    }
    const minString = field.props?.min ?? field.min ?? "";
    if (!minString) {
      return null;
    }
    const type = field.props?.type ?? field.type ?? "";
    const inputMode = field.props?.inputMode ?? field.inputMode ?? "";
    const value = getConstraintValue(field);
    const isNumber = type === "number" || inputMode === "numeric";
    if (isNumber) {
      const minNumber = parseFloat(minString);
      if (isNaN(minNumber)) {
        return null;
      }
      const numericValue = Number(value);
      if (isNaN(numericValue)) {
        return null;
      }
      if (numericValue < minNumber) {
        const naviInputType =
          field.props?.["navi-input-type"] ??
          field.getAttribute?.("navi-input-type");
        return naviI18n(`constraint.min.${naviInputType || "number"}.default`, {
          min: minString,
        });
      }
      return null;
    }
    if (type === "time") {
      if (!value) {
        return null;
      }
      const [minHours, minMinutes] = minString.split(":").map(Number);
      const [hours, minutes] = value.split(":").map(Number);
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
      if (!value) {
        return null;
      }
      if (value < minString) {
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
    const isInput = field.controlType === "input" || field.tagName === "INPUT";
    if (!isInput) {
      return null;
    }
    const maxString = field.props?.max ?? field.max ?? "";
    if (!maxString) {
      return null;
    }
    const type = field.props?.type ?? field.type ?? "";
    const inputMode = field.props?.inputMode ?? field.inputMode ?? "";
    const value = getConstraintValue(field);
    const isNumber = type === "number" || inputMode === "numeric";
    if (isNumber) {
      const maxNumber = parseFloat(maxString);
      if (isNaN(maxNumber)) {
        return null;
      }
      const numericValue = Number(value);
      if (isNaN(numericValue)) {
        return null;
      }
      if (numericValue > maxNumber) {
        const naviInputType =
          field.props?.["navi-input-type"] ??
          field.getAttribute?.("navi-input-type");
        return naviI18n(`constraint.max.${naviInputType || "number"}.default`, {
          max: maxString,
        });
      }
      return null;
    }
    if (type === "time") {
      if (!value) {
        return null;
      }
      const [maxHours, maxMinutes] = maxString.split(":").map(Number);
      const [hours, minutes] = value.split(":").map(Number);
      if (hours > maxHours || (hours === maxHours && minutes > maxMinutes)) {
        return naviI18n("constraint.max.time.default", {
          max: maxString,
        });
      }
      return null;
    }
    if (DATE_INPUT_TYPE_SET.has(type)) {
      if (!value) {
        return null;
      }
      if (value > maxString) {
        const todayIso = getTodayIso(type);
        if (maxString === todayIso) {
          return naviI18n("constraint.max.date.today.default");
        }
        return naviI18n("constraint.max.date.default", {
          max: formatDateIso(maxString, type),
        });
      }
      return null;
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
    const isInput = field.controlType === "input" || field.tagName === "INPUT";
    if (!isInput) {
      return null;
    }
    const type = field.props?.type ?? field.type ?? "";
    const inputMode = field.props?.inputMode ?? field.inputMode ?? "";
    const isNumericText = type === "text" && inputMode === "numeric";
    if (!isNumericText && !STEP_SUPPORTED_TYPE_SET.has(type)) {
      return null;
    }
    const stepString = field.props?.step ?? field.step ?? "";
    if (!stepString || stepString === "any") {
      return null;
    }
    const value = getConstraintValue(field);
    const minString = field.props?.min ?? field.min ?? "";
    const isNumber = type === "number" || isNumericText;
    if (isNumber) {
      const step = parseFloat(stepString);
      const base = minString ? parseFloat(minString) : 0;
      const numericValue = Number(value);
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
      const naviInputType =
        field.props?.["navi-input-type"] ??
        field.getAttribute?.("navi-input-type");
      return naviI18n(`constraint.step.${naviInputType || "number"}.default`, {
        step: stepString,
        before: before.toFixed(decimals),
        after: after.toFixed(decimals),
      });
    }
    if (type === "time") {
      const stepSeconds = parseFloat(stepString);
      if (!isNaN(stepSeconds)) {
        const stepMs = stepSeconds * 1000;
        const valueMs = timeStringToMs(value);
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
      const valueDate = new Date(`${value}T00:00:00`);
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
