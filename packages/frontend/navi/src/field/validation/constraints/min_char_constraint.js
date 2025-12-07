import { generateFieldInvalidMessage } from "./constraint_message_util.js";

export const MIN_LOWER_LETTER_CONSTRAINT = {
  name: "min_lower_letter",
  messageAttribute: "data-min-lower-letter-message",
  check: (field) => {
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return "";
    }
    const minAttribute = field.getAttribute("data-min-lower-letter");
    if (!minAttribute) {
      return "";
    }
    const min = parseInt(minAttribute, 10);
    let numberOfLowercaseChars = 0;
    for (const char of fieldValue) {
      if (char >= "a" && char <= "z") {
        numberOfLowercaseChars++;
      }
    }
    if (numberOfLowercaseChars < min) {
      if (min === 0) {
        return generateFieldInvalidMessage(
          `{field} doit contenir au moins une lettre minuscule.`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} contenir au moins ${min} lettres minuscules.`,
        { field },
      );
    }
    return "";
  },
};
export const MIN_UPPER_LETTER_CONSTRAINT = {
  name: "min_upper_letter",
  messageAttribute: "data-min-upper-letter-message",
  check: (field) => {
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return "";
    }
    const minAttribute = field.getAttribute("data-min-upper-letter");
    if (!minAttribute) {
      return "";
    }
    const min = parseInt(minAttribute, 10);
    let numberOfUppercaseChars = 0;
    for (const char of fieldValue) {
      if (char >= "A" && char <= "Z") {
        numberOfUppercaseChars++;
      }
    }
    if (numberOfUppercaseChars < min) {
      if (min === 0) {
        return generateFieldInvalidMessage(
          `{field} doit contenir au moins une lettre majuscule.`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} contenir au moins ${min} lettres majuscules.`,
        { field },
      );
    }
    return "";
  },
};
export const MIN_DIGIT_CONSTRAINT = {
  name: "min_digit",
  messageAttribute: "data-min-digit-message",
  check: (field) => {
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return "";
    }
    const minAttribute = field.getAttribute("data-min-digit");
    if (!minAttribute) {
      return "";
    }
    const min = parseInt(minAttribute, 10);
    let numberOfDigitChars = 0;
    for (const char of fieldValue) {
      if (char >= "0" && char <= "9") {
        numberOfDigitChars++;
      }
    }
    if (numberOfDigitChars < min) {
      if (min === 0) {
        return generateFieldInvalidMessage(
          `{field} doit contenir au moins un chiffre.`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} doit contenir au moins ${min} chiffres.`,
        { field },
      );
    }
    return "";
  },
};
export const MIN_SPECIAL_CHAR_CONSTRAINT = {
  name: "min_special_char",
  messageAttribute: "data-min-special-char-message",
  check: (field) => {
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return "";
    }
    const minSpecialChars = field.getAttribute("data-min-special-char");
    if (!minSpecialChars) {
      return "";
    }
    const min = parseInt(minSpecialChars, 10);
    const specialCharset = field.getAttribute("data-special-charset");
    if (!specialCharset) {
      return "L'attribut data-special-charset doit être défini pour utiliser data-min-special-char.";
    }

    let numberOfSpecialChars = 0;
    for (const char of fieldValue) {
      if (specialCharset.includes(char)) {
        numberOfSpecialChars++;
      }
    }
    if (numberOfSpecialChars < min) {
      if (min === 1) {
        return generateFieldInvalidMessage(
          `{field} doit contenir au moins un caractère spécial. (${specialCharset})`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} doit contenir au moins ${min} caractères spéciaux (${specialCharset})`,
        { field },
      );
    }
    return "";
  },
};
