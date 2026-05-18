/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */

import { formatDay, formatMonth } from "@jsenv/navi/src/text/format_time.js";
import { langSignal } from "@jsenv/navi/src/text/lang_signal.js";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";
import { generateFieldInvalidMessage } from "./constraint_message_util.js";

// this constraint is not really a native constraint and browser just not let this happen at all
// in our case it's just here in case some code is wrongly calling "requestAction" or "checkValidity" on a disabled element
export const DISABLED_CONSTRAINT = {
  name: "disabled",
  messageAttribute: "data-disabled-message",
  check: (field) => {
    if (field.disabled) {
      return generateFieldInvalidMessage("constraint.disabled", { field });
    }
    return null;
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("disabled");
CONSTRAINT_ATTRIBUTE_SET.add("data-disabled");
CONSTRAINT_ATTRIBUTE_SET.add("data-disabled-message");

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
      const isCheckboxGroup =
        field.name?.endsWith("[]") ||
        Boolean(field.closest("[navi-checkbox-list]"));
      if (isCheckboxGroup) {
        const name = field.name;
        const checkboxSetContainer =
          field.closest("[navi-checkbox-list], fieldset, form") || document;
        const checkboxSelector = `input[type="checkbox"][name="${CSS.escape(name)}"]`;
        const checkboxes =
          checkboxSetContainer.querySelectorAll(checkboxSelector);
        for (const checkbox of checkboxes) {
          if (checkbox.checked) {
            return null;
          }
          registerChange((onChange) => {
            checkbox.addEventListener("change", onChange);
            return () => {
              checkbox.removeEventListener("change", onChange);
            };
          });
        }
        return {
          message: naviI18n("constraint.required.checkbox_group"),
          target:
            checkboxSetContainer.tagName === "FIELDSET"
              ? checkboxSetContainer.querySelector("legend")
              : undefined,
        };
      }
      if (!field.checked) {
        return naviI18n("constraint.required.checkbox");
      }
      return null;
    }
    if (field.type === "radio") {
      // For radio buttons, check if any radio with the same name is selected
      const name = field.name;
      if (!name) {
        // If no name, check just this radio
        if (!field.checked) {
          return naviI18n("constraint.required.radio");
        }
        return null;
      }
      const radioSetContainer =
        field.closest("[navi-radio-list], fieldset, form") || document;
      // Check if any radio with the same name is checked
      const radioSelector = `input[type="radio"][name="${CSS.escape(name)}"]`;
      const radiosWithSameName =
        radioSetContainer.querySelectorAll(radioSelector);
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
        target:
          radioSetContainer.tagName === "FIELDSET"
            ? radioSetContainer.querySelector("legend")
            : undefined,
      };
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
    if (field.hasAttribute("data-same-as")) {
      return naviI18n("constraint.required.confirm");
    }
    if (field.getAttribute("data-rendered-by") === ".navi_list_container") {
      return naviI18n("constraint.required.select");
    }
    if (field.getAttribute("data-rendered-by") === ".navi_select") {
      return naviI18n("constraint.required.select");
    }
    return naviI18n("constraint.required.default");
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("required");
CONSTRAINT_ATTRIBUTE_SET.add("data-required-message");

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
    let message = generateFieldInvalidMessage("constraint.pattern", { field });
    const title = field.title;
    if (title) {
      message += `<br />${title}`;
    }
    return message;
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("pattern");
CONSTRAINT_ATTRIBUTE_SET.add("data-pattern-message");

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
CONSTRAINT_ATTRIBUTE_SET.add("data-type-message");

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
      return generateFieldInvalidMessage("constraint.min_length.singular", {
        field,
        min: String(minLength),
      });
    }
    return generateFieldInvalidMessage("constraint.min_length.plural", {
      field,
      min: String(minLength),
      count: String(valueLength),
    });
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("minLength");
CONSTRAINT_ATTRIBUTE_SET.add("data-min-length-message");
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
    return generateFieldInvalidMessage("constraint.max_length", {
      field,
      max: String(maxLength),
      count: String(valueLength),
    });
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("maxLength");
CONSTRAINT_ATTRIBUTE_SET.add("data-max-length-message");
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
    if (field.type !== "number") {
      return null;
    }
    if (field.validity.valueMissing) {
      // let required handle that
      return null;
    }
    const valueAsNumber = field.valueAsNumber;
    const valueAsNumberIsNaN = isNaN(valueAsNumber);
    if (valueAsNumberIsNaN) {
      return generateFieldInvalidMessage("constraint.type.number", { field });
    }
    return null;
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-type-message");

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
    if (field.type === "number") {
      const minNumber = parseFloat(minString);
      if (isNaN(minNumber)) {
        return null;
      }
      const valueAsNumber = field.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber < minNumber) {
        return generateFieldInvalidMessage("constraint.min.number", {
          field,
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
        return generateFieldInvalidMessage("constraint.min.time", {
          field,
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
          return generateFieldInvalidMessage("constraint.min.date.today", {
            field,
          });
        }
        return generateFieldInvalidMessage("constraint.min.date", {
          field,
          min: formatDateIso(minString, field.type),
        });
      }
      return null;
    }
    return null;
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("min");
CONSTRAINT_ATTRIBUTE_SET.add("data-min-message");

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
    if (field.type === "number") {
      const maxNumber = parseFloat(maxString);
      if (isNaN(maxNumber)) {
        return null;
      }
      const valueAsNumber = field.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber > maxNumber) {
        return generateFieldInvalidMessage("constraint.max.number", {
          field,
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
        return generateFieldInvalidMessage("constraint.max.time", {
          field,
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
          return generateFieldInvalidMessage("constraint.max.date.today", {
            field,
          });
        }
        return generateFieldInvalidMessage("constraint.max.date", {
          field,
          max: formatDateIso(maxString, field.type),
        });
      }
      return null;
    }
    return null;
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("max");
CONSTRAINT_ATTRIBUTE_SET.add("data-max-message");

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
  // date, week, datetime-local: parse and use formatDay
  const dateStr = iso.slice(0, 10);
  const date = new Date(`${dateStr}T00:00:00`);
  return formatDay(date, locale, { long: true });
};
