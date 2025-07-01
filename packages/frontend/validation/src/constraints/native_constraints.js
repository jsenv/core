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
      if (!inputTypeSupportinghMinLengthSet.has(element.type)) {
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
const inputTypeSupportinghMinLengthSet = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
]);
const inputTypeSupportingMaxLengthSet = new Set(
  inputTypeSupportinghMinLengthSet,
);
export const MAX_LENGTH_CONSTRAINT = {
  name: "max_length",
  check: (element) => {
    if (element.tagName === "INPUT") {
      if (!inputTypeSupportingMaxLengthSet.has(element.type)) {
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
