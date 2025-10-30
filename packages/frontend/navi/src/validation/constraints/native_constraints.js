/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */

// this constraint is not really a native constraint and browser just not let this happen at all
// in our case it's just here in case some code is wrongly calling "requestAction" or "checkValidity" on a disabled element
export const DISABLED_CONSTRAINT = {
  name: "disabled",
  check: (element) => {
    if (element.disabled) {
      return `Ce champ est désactivé.`;
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
    const requiredMessage = element.getAttribute("data-required-message");

    if (element.type === "checkbox") {
      if (!element.checked) {
        return requiredMessage || `Veuillez cocher cette case.`;
      }
      return null;
    }
    if (element.type === "radio") {
      // For radio buttons, check if any radio with the same name is selected
      const name = element.name;
      if (!name) {
        // If no name, check just this radio
        if (!element.checked) {
          return requiredMessage || `Veuillez sélectionner une option.`;
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
          requiredMessage ||
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
    if (requiredMessage) {
      return requiredMessage;
    }
    if (element.type === "password") {
      return `Veuillez saisir un mot de passe.`;
    }
    if (element.type === "email") {
      return `Veuillez saisir une adresse e-mail.`;
    }
    return `Veuillez remplir ce champ.`;
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
    const patternMessage = input.getAttribute("data-pattern-message");
    if (patternMessage) {
      return patternMessage;
    }
    let message = `Veuillez respecter le format requis.`;
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
    if (!value.includes("@")) {
      return `Veuillez inclure "@" dans l'adresse e-mail. Il manque un symbole "@" dans ${value}.`;
    }
    if (!emailregex.test(value)) {
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
      const thisField = generateThisFieldText(element);
      if (valueLength === 1) {
        return `${thisField} doit contenir au moins ${minLength} caractère (il contient actuellement un seul caractère).`;
      }
      return `${thisField} doit contenir au moins ${minLength} caractères (il contient actuellement ${valueLength} caractères).`;
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

const generateThisFieldText = (field) => {
  return field.type === "password"
    ? "Ce mot de passe"
    : field.type === "email"
      ? "Cette adresse e-mail"
      : "Ce champ";
};

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
      const thisField = generateThisFieldText(element);
      return `${thisField} doit contenir au maximum ${maxLength} caractères (il contient actuellement ${valueLength} caractères).`;
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
      return `Doit être un nombre.`;
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
        const minMessage = element.getAttribute("data-min-message");
        return (
          minMessage ||
          `Doit être supérieur ou égal à <strong>${minString}</strong>.`
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
      if (hours < minHours) {
        return `Doit être <strong>${min}</strong> ou plus.`;
      }
      if (hours === minHours && minMinutes < minutes) {
        return `Doit être <strong>${min}</strong> ou plus.`;
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
        const maxMessage = element.getAttribute("data-max-message");
        return maxMessage || `Doit être <strong>${maxString}</strong> ou plus.`;
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
      if (hours > maxHours) {
        return `Doit être <strong>${max}</strong> ou moins.`;
      }
      if (hours === maxHours && maxMinutes > minutes) {
        return `Doit être <strong>${max}</strong> ou moins.`;
      }
      return null;
    }
    return null;
  },
};
