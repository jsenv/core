/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */

export const REQUIRED_CONSTRAINT = {
  name: "required",
  check: (input) => {
    if (input.required && !input.value) {
      return `Veuillez remplir ce champ.`;
    }
    return null;
  },
};
export const PATTERN_CONSTRAINT = {
  name: "pattern",
  check: (input) => {
    const pattern = input.pattern;
    if (!pattern) {
      return null;
    }
    const regex = new RegExp(pattern);

    const value = input.value;
    if (!regex.test(value)) {
      const title = input.title;
      let message = `Veuillez respecter le format requis.`;
      if (title) {
        message += `<br />${title}`;
      }
      return message;
    }
    return null;
  },
};
// https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/email#validation
const emailregex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
export const TYPE_EMAIL_CONSTRAINT = {
  name: "type_email",
  check: (input) => {
    if (input.type === "email") {
      const value = input.value;
      if (!value.includes("@")) {
        return `Veuillez inclure "@" dans l'adresse e-mail. Il manque un symbole "@" dans ${value}.`;
      }
      if (!emailregex.test(input.value)) {
        return `Veuillez saisir une adresse e-mail valide.`;
      }
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
    if (!minLength) {
      return null;
    }

    const value = element.value;
    const valueLength = value.length;
    if (valueLength === 0) {
      return null;
    }
    if (value < valueLength) {
      if (valueLength === 1) {
        return `Ce champ doit contenir au moins ${minLength} caractère (il contient actuellement un seul caractère).`;
      }
      return `Ce champ doit contenir au moins ${minLength} caractères (il contient actuellement ${valueLength} caractères).`;
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
    if (!maxLength) {
      return null;
    }

    const value = element.value;
    const valueLength = value.length;
    if (valueLength > maxLength) {
      return `Ce champ doit contenir au maximum ${maxLength} caractères (il contient actuellement ${valueLength} caractères).`;
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
    if (!INPUT_TYPE_SUPPORTING_MIN_SET.has(element.type)) {
      return null;
    }
    const min = element.min;
    if (min === undefined) {
      return null;
    }
    const valueAsNumber = element.valueAsNumber;
    if (isNaN(valueAsNumber)) {
      return null;
    }
    if (valueAsNumber < min) {
      return `Doit être supérieur ou égal à <strong>${min}</strong>.`;
    }
    return null;
  },
};
const INPUT_TYPE_SUPPORTING_MIN_SET = new Set([
  "range",
  "number",
  "date",
  "month",
  "week",
  "datetime-local",
  "time",
]);

export const MAX_CONSTRAINT = {
  name: "max",
  check: (element) => {
    if (element.tagName !== "INPUT") {
      return null;
    }
    const type = element.type;
    if (!INPUT_TYPE_SUPPORTING_MAX_SET.has(type)) {
      return null;
    }
    return null;
  },
};
const INPUT_TYPE_SUPPORTING_MAX_SET = new Set(INPUT_TYPE_SUPPORTING_MIN_SET);
