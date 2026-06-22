import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const MIN_LOWER_LETTER_CONSTRAINT = {
  name: "min_lower_letter",
  messageAttribute: "data-min-lower-letter-message",
  check: (field) => {
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    const required = field.controlHostProps.required;
    if (!valueAsString && !required) {
      return "";
    }
    const minAttribute = field.controlHostProps["data-min-lower-letter"];
    if (!minAttribute) {
      return "";
    }
    const min = parseInt(minAttribute, 10);
    let numberOfLowercaseChars = 0;
    for (const char of valueAsString) {
      if (char >= "a" && char <= "z") {
        numberOfLowercaseChars++;
      }
    }
    if (numberOfLowercaseChars >= min) {
      return null;
    }

    if (min === 1) {
      const type = field.controlHostProps.type;
      if (type === "password") {
        return naviI18n("constraint.min_lower_letter.password.singular");
      }
      return naviI18n("constraint.min_lower_letter.default.singular");
    }
    const key = (() => {
      const type = field.controlHostProps.type;
      if (type === "password") {
        return "constraint.min_lower_letter.password.plural";
      }
      return "constraint.min_lower_letter.default.plural";
    })();
    return naviI18n(key, {
      min: String(min),
    });
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-min-lower-letter");

export const MIN_UPPER_LETTER_CONSTRAINT = {
  name: "min_upper_letter",
  messageAttribute: "data-min-upper-letter-message",
  check: (field) => {
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    const required = field.controlHostProps.required;
    if (!valueAsString && !required) {
      return null;
    }
    const minAttribute = field.controlHostProps["data-min-upper-letter"];
    if (!minAttribute) {
      return null;
    }
    const min = parseInt(minAttribute, 10);
    let numberOfUppercaseChars = 0;
    for (const char of valueAsString) {
      if (char >= "A" && char <= "Z") {
        numberOfUppercaseChars++;
      }
    }
    if (numberOfUppercaseChars >= min) {
      return null;
    }

    const type = field.controlHostProps.type;
    const context = type === "password" ? "password" : "default";
    if (min === 1) {
      return naviI18n(`constraint.min_upper_letter.${context}.singular`);
    }
    return naviI18n(`constraint.min_upper_letter.${context}.plural`, {
      min: String(min),
    });
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-min-upper-letter");

export const MIN_DIGIT_CONSTRAINT = {
  name: "min_digit",
  messageAttribute: "data-min-digit-message",
  check: (field) => {
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    const required = field.controlHostProps.required;
    if (!valueAsString && !required) {
      return null;
    }
    const minAttribute = field.controlHostProps["data-min-digit"];
    if (!minAttribute) {
      return null;
    }
    const min = parseInt(minAttribute, 10);
    let numberOfDigitChars = 0;
    for (const char of valueAsString) {
      if (char >= "0" && char <= "9") {
        numberOfDigitChars++;
      }
    }
    if (numberOfDigitChars >= min) {
      return null;
    }

    const type = field.controlHostProps.type;
    const context = type === "password" ? "password" : "default";
    if (min === 1) {
      return naviI18n(`constraint.min_digit.${context}.singular`);
    }
    return naviI18n(`constraint.min_digit.${context}.plural`, {
      min: String(min),
    });
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-min-digit");

export const MIN_SPECIAL_CHAR_CONSTRAINT = {
  name: "min_special_char",
  messageAttribute: "data-min-special-char-message",
  check: (field) => {
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    const required = field.controlHostProps.required;
    if (!valueAsString && !required) {
      return null;
    }
    const minSpecialChars = field.controlHostProps["data-min-special-char"];
    if (!minSpecialChars) {
      return null;
    }
    const min = parseInt(minSpecialChars, 10);
    const specialCharset = field.controlHostProps["data-special-charset"];
    if (!specialCharset) {
      return "L'attribut data-special-charset doit être défini pour utiliser data-min-special-char.";
    }

    let numberOfSpecialChars = 0;
    for (const char of valueAsString) {
      if (specialCharset.includes(char)) {
        numberOfSpecialChars++;
      }
    }
    if (numberOfSpecialChars >= min) {
      return null;
    }

    const type = field.controlHostProps.type;
    const context = type === "password" ? "password" : "default";
    if (min === 1) {
      return naviI18n(`constraint.min_special_char.${context}.singular`, {
        charset: specialCharset,
      });
    }
    return naviI18n(`constraint.min_special_char.${context}.plural`, {
      min: String(min),
      charset: specialCharset,
    });
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-special-charset");
CONSTRAINT_ATTRIBUTE_SET.add("data-min-special-char");
