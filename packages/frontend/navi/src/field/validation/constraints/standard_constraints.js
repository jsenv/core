/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */

import { generateFieldInvalidMessage } from "./constraint_message_util.js";

// this constraint is not really a native constraint and browser just not let this happen at all
// in our case it's just here in case some code is wrongly calling "requestAction" or "checkValidity" on a disabled element
export const DISABLED_CONSTRAINT = {
  name: "disabled",
  check: (element) => {
    if (element.disabled) {
      return generateFieldInvalidMessage(`{field} est désactivé.`, {
        field: element,
      });
    }
    return null;
  },
};

export const REQUIRED_CONSTRAINT = {
  name: "required",
  check: (element, { registerChange }) => {
    if (!element.required) {
      return null;
    }
    const messageAttribute = element.getAttribute("data-required-message");

    if (element.type === "checkbox") {
      if (!element.checked) {
        if (messageAttribute) {
          return messageAttribute;
        }
        return `Veuillez cocher cette case.`;
      }
      return null;
    }
    if (element.type === "radio") {
      // For radio buttons, check if any radio with the same name is selected
      const name = element.name;
      if (!name) {
        // If no name, check just this radio
        if (!element.checked) {
          if (messageAttribute) {
            return messageAttribute;
          }
          return `Veuillez sélectionner une option.`;
        }
        return null;
      }

      const closestFieldset = element.closest("fieldset");
      const fieldsetRequiredMessage = closestFieldset
        ? closestFieldset.getAttribute("data-required-message")
        : null;

      // Find the container (form or closest fieldset)
      const container = element.form || closestFieldset || document;
      // Check if any radio with the same name is checked
      const radioSelector = `input[type="radio"][name="${CSS.escape(name)}"]`;
      const radiosWithSameName = container.querySelectorAll(radioSelector);
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
        message:
          messageAttribute ||
          fieldsetRequiredMessage ||
          `Veuillez sélectionner une option.`,
        target: closestFieldset
          ? closestFieldset.querySelector("legend")
          : undefined,
      };
    }
    if (element.value) {
      return null;
    }
    if (messageAttribute) {
      return messageAttribute;
    }
    if (element.type === "password") {
      return element.hasAttribute("data-same-as")
        ? `Veuillez confirmer le mot de passe.`
        : `Veuillez saisir un mot de passe.`;
    }
    if (element.type === "email") {
      return element.hasAttribute("data-same-as")
        ? `Veuillez confirmer l'adresse e-mail`
        : `Veuillez saisir une adresse e-mail.`;
    }
    return element.hasAttribute("data-same-as")
      ? `Veuillez confirmer le champ précédent`
      : `Veuillez remplir ce champ.`;
  },
};

export const PATTERN_CONSTRAINT = {
  name: "pattern",
  check: (input) => {
    const pattern = input.pattern;
    if (!pattern) {
      return null;
    }
    const value = input.value;
    if (!value) {
      return null;
    }
    const regex = new RegExp(pattern);
    if (regex.test(value)) {
      return null;
    }
    const messageAttribute = input.getAttribute("data-pattern-message");
    if (messageAttribute) {
      return messageAttribute;
    }
    let message = generateFieldInvalidMessage(
      `{field} ne correspond pas au format requis.`,
      { field: input },
    );
    const title = input.title;
    if (title) {
      message += `<br />${title}`;
    }
    return message;
  },
};
// https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/email#validation
const emailregex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
export const TYPE_EMAIL_CONSTRAINT = {
  name: "type_email",
  check: (input) => {
    if (input.type !== "email") {
      return null;
    }
    const value = input.value;
    if (!value) {
      return null;
    }
    const messageAttribute = input.getAttribute("data-type-email-message");
    if (!value.includes("@")) {
      if (messageAttribute) {
        return messageAttribute;
      }
      return `Veuillez inclure "@" dans l'adresse e-mail. Il manque un symbole "@" dans ${value}.`;
    }
    if (!emailregex.test(value)) {
      if (messageAttribute) {
        return messageAttribute;
      }
      return `Veuillez saisir une adresse e-mail valide.`;
    }
    return null;
  },
};

export const MIN_LENGTH_CONSTRAINT = {
  name: "min_length",
  check: (element) => {
    if (element.tagName === "INPUT") {
      if (!INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET.has(element.type)) {
        return null;
      }
    } else if (element.tagName !== "TEXTAREA") {
      return null;
    }

    const minLength = element.minLength;
    if (minLength === -1) {
      return null;
    }

    const value = element.value;
    const valueLength = value.length;
    if (valueLength === 0) {
      return null;
    }
    if (valueLength < minLength) {
      const messageAttribute = element.getAttribute("data-min-length-message");
      if (messageAttribute) {
        return messageAttribute;
      }
      if (valueLength === 1) {
        return generateFieldInvalidMessage(
          `{field} doit contenir au moins ${minLength} caractère (il contient actuellement un seul caractère).`,
          { field: element },
        );
      }
      return generateFieldInvalidMessage(
        `{field} doit contenir au moins ${minLength} caractères (il contient actuellement ${valueLength} caractères).`,
        { field: element },
      );
    }
    return null;
  },
};
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
  check: (element) => {
    if (element.tagName === "INPUT") {
      if (!INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET.has(element.type)) {
        return null;
      }
    } else if (element.tagName !== "TEXTAREA") {
      return null;
    }

    const maxLength = element.maxLength;
    if (maxLength === -1) {
      return null;
    }

    const value = element.value;
    const valueLength = value.length;
    if (valueLength > maxLength) {
      const messageAttribute = element.getAttribute("data-max-length-message");
      if (messageAttribute) {
        return messageAttribute;
      }
      return generateFieldInvalidMessage(
        `{field} doit contenir au maximum ${maxLength} caractères (il contient actuellement ${valueLength} caractères).`,
        { field: element },
      );
    }
    return null;
  },
};
const INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET = new Set(
  INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET,
);

export const TYPE_NUMBER_CONSTRAINT = {
  name: "type_number",
  check: (element) => {
    if (element.tagName !== "INPUT") {
      return null;
    }
    if (element.type !== "number") {
      return null;
    }
    if (element.value === "") {
      return null;
    }
    const value = element.valueAsNumber;
    if (isNaN(value)) {
      const messageAttribute = element.getAttribute("data-type-number-message");
      if (messageAttribute) {
        return messageAttribute;
      }
      return generateFieldInvalidMessage(`{field} doit être un nombre.`, {
        field: element,
      });
    }
    return null;
  },
};

export const MIN_CONSTRAINT = {
  name: "min",
  check: (element) => {
    if (element.tagName !== "INPUT") {
      return null;
    }
    if (element.type === "number") {
      const minString = element.min;
      if (minString === "") {
        return null;
      }
      const minNumber = parseFloat(minString);
      if (isNaN(minNumber)) {
        return null;
      }
      const valueAsNumber = element.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber < minNumber) {
        const messageAttribute = element.getAttribute("data-min-message");
        if (messageAttribute) {
          return messageAttribute;
        }
        return generateFieldInvalidMessage(
          `{field} doit être supérieur ou égal à <strong>${minString}</strong>.`,
          { field: element },
        );
      }
      return null;
    }
    if (element.type === "time") {
      const min = element.min;
      if (min === undefined) {
        return null;
      }
      const [minHours, minMinutes] = min.split(":").map(Number);
      const value = element.value;
      const [hours, minutes] = value.split(":").map(Number);
      const messageAttribute = element.getAttribute("data-min-message");
      if (hours < minHours || (hours === minHours && minMinutes < minutes)) {
        if (messageAttribute) {
          return messageAttribute;
        }
        return generateFieldInvalidMessage(
          `{field} doit être <strong>${min}</strong> ou plus.`,
          { field: element },
        );
      }
      return null;
    }
    // "range"
    // - user interface do not let user enter anything outside the boundaries
    // - when setting value via js browser enforce boundaries too
    // "date", "month", "week", "datetime-local"
    // - same as "range"
    return null;
  },
};

export const MAX_CONSTRAINT = {
  name: "max",
  check: (element) => {
    if (element.tagName !== "INPUT") {
      return null;
    }
    if (element.type === "number") {
      const maxString = element.max;
      if (maxString === "") {
        return null;
      }
      const maxNumber = parseFloat(maxString);
      if (isNaN(maxNumber)) {
        return null;
      }
      const valueAsNumber = element.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber > maxNumber) {
        const messageAttribute = element.getAttribute("data-max-message");
        if (messageAttribute) {
          return messageAttribute;
        }
        return generateFieldInvalidMessage(
          `{field} être <strong>${maxString}</strong> ou plus.`,
          { field: element },
        );
      }
      return null;
    }
    if (element.type === "time") {
      const max = element.min;
      if (max === undefined) {
        return null;
      }
      const [maxHours, maxMinutes] = max.split(":").map(Number);
      const value = element.value;
      const [hours, minutes] = value.split(":").map(Number);
      if (hours > maxHours || (hours === maxHours && maxMinutes > minutes)) {
        const messageAttribute = element.getAttribute("data-max-message");
        if (messageAttribute) {
          return messageAttribute;
        }
        return generateFieldInvalidMessage(
          `{field} doit être <strong>${max}</strong> ou moins.`,
          { field: element },
        );
      }
      return null;
    }
    return null;
  },
};
