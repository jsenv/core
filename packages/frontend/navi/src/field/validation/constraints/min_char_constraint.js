import { generateFieldInvalidMessage } from "./constraint_message_util.js";

export const MIN_LOWER_LETTER_CONSTRAINT = {
  name: "min_lower_letter",
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
      const messageAttribute = field.getAttribute(
        "data-min-lower-letter-message",
      );
      if (messageAttribute) {
        return messageAttribute;
      }
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
      const messageAttribute = field.getAttribute(
        "data-min-upper-letter-message",
      );
      if (messageAttribute) {
        return messageAttribute;
      }
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
      const messageAttribute = field.getAttribute("data-min-digit-message");
      if (messageAttribute) {
        return messageAttribute;
      }
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
export const MIN_SPECIAL_CHARS_CONSTRAINT = {
  name: "min_special_chars",
  check: (field) => {
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return "";
    }
    const minSpecialChars = field.getAttribute("data-min-special-chars");
    if (!minSpecialChars) {
      return "";
    }
    const min = parseInt(minSpecialChars, 10);
    const specialChars = field.getAttribute("data-special-chars");
    if (!specialChars) {
      return "L'attribut data-special-chars doit être défini pour utiliser data-min-special-chars.";
    }

    let numberOfSpecialChars = 0;
    for (const char of fieldValue) {
      if (specialChars.includes(char)) {
        numberOfSpecialChars++;
      }
    }
    if (numberOfSpecialChars < min) {
      const messageAttribute = field.getAttribute(
        "data-min-special-chars-message",
      );
      if (messageAttribute) {
        return messageAttribute;
      }
      if (min === 1) {
        return generateFieldInvalidMessage(
          `{field} doit contenir au moins un caractère spécial. (${specialChars})`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} doit contenir au moins ${min} caractères spéciaux (${specialChars})`,
        { field },
      );
    }
    return "";
  },
};
