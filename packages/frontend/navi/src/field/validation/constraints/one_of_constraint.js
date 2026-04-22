import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const ONE_OF_CONSTRAINT = {
  name: "one_of",
  messageAttribute: "data-one-of-message",
  check: (field) => {
    const oneOf = field.getAttribute("data-one-of");
    if (!oneOf) {
      return null;
    }
    const fieldValue = field.value;
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
    const message = field.getAttribute("data-one-of-message");
    const noMatchMessage = field.getAttribute("data-one-of-no-match-message");
    if (isNoMatch) {
      return (
        noMatchMessage || `Aucune suggestion ne correspond à votre saisie.`
      );
    }
    return message || `Veuillez choisir une valeur parmi les suggestions.`;
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-one-of");
CONSTRAINT_ATTRIBUTE_SET.add("data-one-of-message");
CONSTRAINT_ATTRIBUTE_SET.add("data-one-of-no-match-message");

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
