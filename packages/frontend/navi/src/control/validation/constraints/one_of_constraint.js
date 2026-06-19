import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";
import { getConstraintValue } from "./constraint_message_util.js";

export const ONE_OF_CONSTRAINT = {
  name: "one_of",
  messageAttribute: "data-one-of-message",
  check: (field) => {
    const oneOf =
      field.props !== undefined
        ? field.props["data-one-of"]
        : field.getAttribute("data-one-of");
    if (!oneOf) {
      return null;
    }
    const fieldValue = getConstraintValue(field);
    if (!fieldValue) {
      return null;
    }
    const listEl = document.querySelector(oneOf);
    if (!listEl) {
      console.warn(
        `One of constraint: could not find element for selector "${oneOf}"`,
      );
      return null;
    }
    const allowedValues = collectAllowedValues(listEl);
    if (allowedValues.size === 0) {
      return null;
    }
    if (allowedValues.has(fieldValue)) {
      return null;
    }
    const visibleOptions = listEl.querySelectorAll(
      "[role='option']:not([hidden])",
    );
    const isNoMatch = visibleOptions.length === 0;
    const message =
      field.props?.["data-one-of-message"] ??
      field.getAttribute?.("data-one-of-message");
    const noMatchMessage =
      field.props?.["data-one-of-no-match-message"] ??
      field.getAttribute?.("data-one-of-no-match-message");
    if (isNoMatch) {
      return noMatchMessage || naviI18n("constraint.one_of.no_match");
    }
    return message || naviI18n("constraint.one_of.default");
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-one-of");

const collectAllowedValues = (listEl) => {
  const values = new Set();
  for (const optionEl of listEl.querySelectorAll("[role='option']")) {
    const value =
      optionEl.dataset.value ??
      optionEl.getAttribute("value") ??
      optionEl.textContent.trim();
    if (value) {
      values.add(value);
    }
  }
  return values;
};
