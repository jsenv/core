/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */

import { formatDay, formatMonth } from "@jsenv/navi/src/text/format_time.js";
import { langSignal } from "@jsenv/navi/src/text/lang_signal.js";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { getUIStateFromElement } from "../../ui_state_dom.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";
import { fieldTypeSuffix } from "./constraint_message_util.js";

// this constraint is not really a native constraint and browser just not let this happen at all
// in our case it's just here in case some code is wrongly calling "requestAction" or "checkValidity" on a disabled element
export const DISABLED_CONSTRAINT = {
  name: "disabled",
  messageAttribute: "data-disabled-message",
  check: (field) => {
    if (field.disabled) {
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
  check: (field, { skipRequired, registerChange }) => {
    if (!field.required) {
      return null;
    }
    if (skipRequired) {
      return null;
    }
    if (field.type === "checkbox") {
      const name = field.name;
      if (name) {
        const groupContainer = field.closest('[navi-control="checkbox_group"]');
        if (groupContainer) {
          const groupUIState = getUIStateFromElement(groupContainer);
          if (groupUIState.length === 0) {
            return {
              message: naviI18n("constraint.required.checkbox_group"),
              target: groupContainer,
            };
          }
          return null;
        }
        const checkboxGroupContainer = field.form || document;
        const checkboxSelector = `input[type="checkbox"][name="${CSS.escape(name)}"]`;
        const checkboxArray =
          checkboxGroupContainer.querySelectorAll(checkboxSelector);
        if (checkboxArray.length > 1) {
          for (const checkbox of checkboxArray) {
            if (checkbox.checked) {
              return null;
            }
            registerChange((onChange) => {
              checkbox.addEventListener("input", onChange);
              return () => {
                checkbox.removeEventListener("input", onChange);
              };
            });
          }
          return {
            message: naviI18n("constraint.required.checkbox_group"),
            target: field.closest("fieldset") || undefined,
          };
        }
      }
      // no name or single checkbox with that name
      if (!field.checked) {
        return naviI18n("constraint.required.checkbox");
      }
      return null;
    }
    if (field.type === "radio") {
      // For radio buttons, check if any radio with the same name is selected
      const name = field.name;
      if (name) {
        const groupContainer = field.closest('[navi-control="radio_group"]');
        if (groupContainer) {
          const groupUIState = getUIStateFromElement(groupContainer);
          if (groupUIState === undefined) {
            return {
              message: naviI18n("constraint.required.radio"),
              target: groupContainer,
            };
          }
          return null;
        }
        const radioGroupContainer = field.form || document;
        // Check if any radio with the same name is checked
        const radioSelector = `input[type="radio"][name="${CSS.escape(name)}"]`;
        const radiosWithSameName =
          radioGroupContainer.querySelectorAll(radioSelector);
        for (const radio of radiosWithSameName) {
          if (radio.checked) {
            return null; // At least one radio is selected
          }
          registerChange((onChange) => {
            radio.addEventListener("change", onChange);
            return () => {
              radio.removeEventListener("change", onChange);
            };
          });
        }
        return {
          message: naviI18n("constraint.required.radio"),
          target: field.closest("fieldset") || undefined,
        };
      }
      // If no name, check just this radio
      if (!field.checked) {
        return naviI18n("constraint.required.radio");
      }
      return null;
    }
    if (field.type === "color") {
      const uiState = getUIStateFromElement(field);
      // The color input always has a value (#000000 when empty) so we rely on
      // uiState to know the user hasn't actually chosen a color
      if (uiState === undefined || uiState === "") {
        return naviI18n("constraint.required.color");
      }
      return null;
    }
    if (field.value) {
      return null;
    }
    if (field.type === "password") {
      return field.hasAttribute("data-same-as")
        ? naviI18n("constraint.required.password.confirm")
        : naviI18n("constraint.required.password");
    }
    if (field.type === "email") {
      return field.hasAttribute("data-same-as")
        ? naviI18n("constraint.required.email.confirm")
        : naviI18n("constraint.required.email");
    }
    if (field.type === "date") {
      return naviI18n("constraint.required.date");
    }
    if (field.type === "month") {
      return naviI18n("constraint.required.month");
    }
    if (field.type === "week") {
      return naviI18n("constraint.required.week");
    }
    if (field.type === "time") {
      return naviI18n("constraint.required.time");
    }
    if (field.type === "number" || field.inputMode === "numeric") {
      return naviI18n("constraint.required.number");
    }
    if (field.type === "datetime-local") {
      return naviI18n("constraint.required.datetime");
    }
    if (field.type === "file") {
      return field.multiple
        ? naviI18n("constraint.required.file.multiple")
        : naviI18n("constraint.required.file");
    }
    if (field.hasAttribute("data-same-as")) {
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
    const pattern = field.pattern;
    if (!pattern) {
      return null;
    }
    const value = field.value;
    if (!value && !field.required) {
      return null;
    }
    const regex = new RegExp(`^(?:${pattern})$`);
    if (regex.test(value)) {
      return null;
    }
    const type = field.type;
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
    if (field.type !== "email") {
      return null;
    }
    const value = field.value;
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
    if (field.tagName === "INPUT") {
      if (!INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET.has(field.type)) {
        return null;
      }
    } else if (field.tagName !== "TEXTAREA") {
      return null;
    }
    const minLength = field.minLength;
    if (minLength === -1) {
      return null;
    }
    const value = field.value;
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
    if (field.tagName === "INPUT") {
      if (!INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET.has(field.type)) {
        return null;
      }
    } else if (field.tagName !== "TEXTAREA") {
      return null;
    }
    const maxLength = field.maxLength;
    if (maxLength === -1) {
      return null;
    }
    const value = field.value;
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
    if (field.tagName !== "INPUT") {
      return null;
    }
    const isNumber = field.type === "number" || field.inputMode === "numeric";
    if (!isNumber) {
      return null;
    }
    if (field.validity.valueMissing) {
      // let required handle that
      return null;
    }
    // valueAsNumber only works for type="number"; for inputMode="numeric"
    // (which is type="text" under the hood) we must parse field.value manually.
    const numericValue =
      field.type === "number" ? field.valueAsNumber : Number(field.value);
    const valueAsNumberIsNaN = isNaN(numericValue);
    if (!valueAsNumberIsNaN) {
      return null;
    }
    const naviInputType = field.getAttribute("navi-input-type");
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
    if (field.tagName !== "INPUT") {
      return null;
    }
    const minString = field.min;
    if (minString === "") {
      return null;
    }
    const isNumber = field.type === "number" || field.inputMode === "numeric";
    if (isNumber) {
      const minNumber = parseFloat(minString);
      if (isNaN(minNumber)) {
        return null;
      }
      const valueAsNumber =
        field.type === "number" ? field.valueAsNumber : Number(field.value);
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber < minNumber) {
        const naviInputType = field.getAttribute("navi-input-type");
        return naviI18n(`constraint.min.${naviInputType || "number"}.default`, {
          min: minString,
        });
      }
      return null;
    }
    if (field.type === "time") {
      const value = field.value;
      if (value === "") {
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
    if (DATE_INPUT_TYPE_SET.has(field.type)) {
      const value = field.value;
      if (!value) {
        return null;
      }
      if (value < minString) {
        const todayIso = getTodayIso(field.type);
        if (minString === todayIso) {
          return naviI18n("constraint.min.date.today.default");
        }
        return naviI18n("constraint.min.date.default", {
          min: formatDateIso(minString, field.type),
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
    if (field.tagName !== "INPUT") {
      return null;
    }
    const maxString = field.max;
    if (maxString === "") {
      return null;
    }
    const isNumber = field.type === "number" || field.inputMode === "numeric";
    if (isNumber) {
      const maxNumber = parseFloat(maxString);
      if (isNaN(maxNumber)) {
        return null;
      }
      const valueAsNumber =
        field.type === "number" ? field.valueAsNumber : Number(field.value);
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber > maxNumber) {
        const naviInputType = field.getAttribute("navi-input-type");
        return naviI18n(`constraint.max.${naviInputType || "number"}.default`, {
          max: maxString,
        });
      }
      return null;
    }
    if (field.type === "time") {
      const value = field.value;
      if (value === "") {
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
    if (DATE_INPUT_TYPE_SET.has(field.type)) {
      const value = field.value;
      if (!value) {
        return null;
      }
      if (value > maxString) {
        const todayIso = getTodayIso(field.type);
        if (maxString === todayIso) {
          return naviI18n("constraint.max.date.today.default");
        }
        return naviI18n("constraint.max.date.default", {
          max: formatDateIso(maxString, field.type),
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
    if (field.tagName !== "INPUT") {
      return null;
    }
    const isNumericText =
      field.type === "text" && field.inputMode === "numeric";
    if (!isNumericText && !STEP_SUPPORTED_TYPE_SET.has(field.type)) {
      return null;
    }
    const stepString = field.step;
    if (stepString === "" || stepString === "any") {
      return null;
    }
    const isNumber = field.type === "number" || isNumericText;
    if (isNumber) {
      const step = parseFloat(stepString);
      const minString = field.min;
      const base = minString !== "" ? parseFloat(minString) : 0;
      const valueAsNumber =
        field.type === "number" ? field.valueAsNumber : Number(field.value);
      if (isNaN(valueAsNumber)) {
        return null;
      }
      const remainder = (((valueAsNumber - base) % step) + step) % step;
      // Use a small epsilon to handle floating-point imprecision
      const epsilon = step * 1e-9;
      const hasMismatch = remainder > epsilon && remainder < step - epsilon;
      if (!hasMismatch) {
        return null;
      }
      const before = base + Math.floor((valueAsNumber - base) / step) * step;
      const after = before + step;
      const decimals = (stepString.split(".")[1] || "").length;
      const naviInputType = field.getAttribute("navi-input-type");
      return naviI18n(`constraint.step.${naviInputType || "number"}.default`, {
        step: stepString,
        before: before.toFixed(decimals),
        after: after.toFixed(decimals),
      });
    }
    if (field.type === "time") {
      const stepSeconds = parseFloat(stepString);
      if (!isNaN(stepSeconds)) {
        const stepMs = stepSeconds * 1000;
        const valueMs = field.valueAsNumber;
        const minString = field.min;
        const baseMs = minString !== "" ? timeStringToMs(minString) : 0;
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
      const value = field.value;
      const minString = field.min;
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
        before: formatDateIso(
          beforeDate.toISOString().slice(0, 10),
          field.type,
        ),
        after: formatDateIso(afterDate.toISOString().slice(0, 10), field.type),
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
