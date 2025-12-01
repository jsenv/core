/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */

import { generateFieldInvalidMessage } from "./constraint_message_util.js";

// this constraint is not really a native constraint and browser just not let this happen at all
// in our case it's just here in case some code is wrongly calling "requestAction" or "checkValidity" on a disabled element
export const DISABLED_CONSTRAINT = {
  name: "disabled",
  check: (field) => {
    if (field.disabled) {
      return generateFieldInvalidMessage(`{field} est désactivé.`, { field });
    }
    return null;
  },
};

export const REQUIRED_CONSTRAINT = {
  name: "required",
  check: (field, { registerChange }) => {
    if (!field.required) {
      return null;
    }
    const messageAttribute = field.getAttribute("data-required-message");

    if (field.type === "checkbox") {
      if (!field.checked) {
        if (messageAttribute) {
          return messageAttribute;
        }
        return `Veuillez cocher cette case.`;
      }
      return null;
    }
    if (field.type === "radio") {
      // For radio buttons, check if any radio with the same name is selected
      const name = field.name;
      if (!name) {
        // If no name, check just this radio
        if (!field.checked) {
          if (messageAttribute) {
            return messageAttribute;
          }
          return `Veuillez sélectionner une option.`;
        }
        return null;
      }

      const closestFieldset = field.closest("fieldset");
      const fieldsetRequiredMessage = closestFieldset
        ? closestFieldset.getAttribute("data-required-message")
        : null;

      // Find the container (form or closest fieldset)
      const container = field.form || closestFieldset || document;
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
    if (field.value) {
      return null;
    }
    if (messageAttribute) {
      return messageAttribute;
    }
    if (field.type === "password") {
      return field.hasAttribute("data-same-as")
        ? `Veuillez confirmer le mot de passe.`
        : `Veuillez saisir un mot de passe.`;
    }
    if (field.type === "email") {
      return field.hasAttribute("data-same-as")
        ? `Veuillez confirmer l'adresse e-mail`
        : `Veuillez saisir une adresse e-mail.`;
    }
    return field.hasAttribute("data-same-as")
      ? `Veuillez confirmer le champ précédent`
      : `Veuillez remplir ce champ.`;
  },
};

export const PATTERN_CONSTRAINT = {
  name: "pattern",
  check: (field) => {
    const pattern = field.pattern;
    if (!pattern) {
      return null;
    }
    const value = field.value;
    if (!value && !field.required) {
      return null;
    }
    const regex = new RegExp(pattern);
    if (regex.test(value)) {
      return null;
    }
    const messageAttribute = field.getAttribute("data-pattern-message");
    if (messageAttribute) {
      return messageAttribute;
    }
    let message = generateFieldInvalidMessage(
      `{field} ne correspond pas au format requis.`,
      { field },
    );
    const title = field.title;
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
  check: (field) => {
    if (field.type !== "email") {
      return null;
    }
    const value = field.value;
    if (!value && !field.required) {
      return null;
    }
    const messageAttribute = field.getAttribute("data-type-email-message");
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
    if (!value && !field.required) {
      return null;
    }
    const valueLength = value.length;
    if (valueLength >= minLength) {
      return null;
    }
    const messageAttribute = field.getAttribute("data-min-length-message");
    if (messageAttribute) {
      return messageAttribute;
    }
    if (valueLength === 1) {
      return generateFieldInvalidMessage(
        `{field} doit contenir au moins ${minLength} caractère (il contient actuellement un seul caractère).`,
        { field },
      );
    }
    return generateFieldInvalidMessage(
      `{field} doit contenir au moins ${minLength} caractères (il contient actuellement ${valueLength} caractères).`,
      { field },
    );
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
    const messageAttribute = field.getAttribute("data-max-length-message");
    if (messageAttribute) {
      return messageAttribute;
    }
    return generateFieldInvalidMessage(
      `{field} doit contenir au maximum ${maxLength} caractères (il contient actuellement ${valueLength} caractères).`,
      { field },
    );
  },
};
const INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET = new Set(
  INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET,
);

export const TYPE_NUMBER_CONSTRAINT = {
  name: "type_number",
  check: (field) => {
    if (field.tagName !== "INPUT") {
      return null;
    }
    if (field.type !== "number") {
      return null;
    }
    if (field.value === "" && !field.required) {
      return null;
    }
    const value = field.valueAsNumber;
    if (isNaN(value)) {
      const messageAttribute = field.getAttribute("data-type-number-message");
      if (messageAttribute) {
        return messageAttribute;
      }
      return generateFieldInvalidMessage(`{field} doit être un nombre.`, {
        field,
      });
    }
    return null;
  },
};

export const MIN_CONSTRAINT = {
  name: "min",
  check: (field) => {
    if (field.tagName !== "INPUT") {
      return null;
    }
    if (field.type === "number") {
      const minString = field.min;
      if (minString === "") {
        return null;
      }
      const minNumber = parseFloat(minString);
      if (isNaN(minNumber)) {
        return null;
      }
      const valueAsNumber = field.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber < minNumber) {
        const messageAttribute = field.getAttribute("data-min-message");
        if (messageAttribute) {
          return messageAttribute;
        }
        return generateFieldInvalidMessage(
          `{field} doit être supérieur ou égal à <strong>${minString}</strong>.`,
          { field },
        );
      }
      return null;
    }
    if (field.type === "time") {
      const min = field.min;
      if (min === undefined) {
        return null;
      }
      const [minHours, minMinutes] = min.split(":").map(Number);
      const value = field.value;
      const [hours, minutes] = value.split(":").map(Number);
      const messageAttribute = field.getAttribute("data-min-message");
      if (hours < minHours || (hours === minHours && minMinutes < minutes)) {
        if (messageAttribute) {
          return messageAttribute;
        }
        return generateFieldInvalidMessage(
          `{field} doit être <strong>${min}</strong> ou plus.`,
          { field },
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
  check: (field) => {
    if (field.tagName !== "INPUT") {
      return null;
    }
    if (field.type === "number") {
      const maxAttribute = field.max;
      if (maxAttribute === "") {
        return null;
      }
      const maxNumber = parseFloat(maxAttribute);
      if (isNaN(maxNumber)) {
        return null;
      }
      const valueAsNumber = field.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber > maxNumber) {
        const messageAttribute = field.getAttribute("data-max-message");
        if (messageAttribute) {
          return messageAttribute;
        }
        return generateFieldInvalidMessage(
          `{field} être <strong>${maxAttribute}</strong> ou plus.`,
          { field },
        );
      }
      return null;
    }
    if (field.type === "time") {
      const max = field.max;
      if (max === undefined) {
        return null;
      }
      const [maxHours, maxMinutes] = max.split(":").map(Number);
      const value = field.value;
      const [hours, minutes] = value.split(":").map(Number);
      if (hours > maxHours || (hours === maxHours && maxMinutes > minutes)) {
        const messageAttribute = field.getAttribute("data-max-message");
        if (messageAttribute) {
          return messageAttribute;
        }
        return generateFieldInvalidMessage(
          `{field} doit être <strong>${max}</strong> ou moins.`,
          { field },
        );
      }
      return null;
    }
    return null;
  },
};
