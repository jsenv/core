import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";
import {
  fieldTypeSuffix,
  getConstraintValue,
} from "./constraint_message_util.js";

export const MIN_LOWER_LETTER_CONSTRAINT = {
  name: "min_lower_letter",
  messageAttribute: "data-min-lower-letter-message",
  check: (field) => {
    const fieldValue = getConstraintValue(field);
    const required = field.props.required;
    if (!fieldValue && !required) {
      return "";
    }
    const minAttribute = field.props["data-min-lower-letter"];
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
      if (min === 1) {
        return naviI18n(
          `constraint.min_lower_letter.singular.${fieldTypeSuffix(field)}`,
        );
      }
      return naviI18n(
        `constraint.min_lower_letter.plural.${fieldTypeSuffix(field)}`,
        {
          min: String(min),
        },
      );
    }
    return "";
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-min-lower-letter");

export const MIN_UPPER_LETTER_CONSTRAINT = {
  name: "min_upper_letter",
  messageAttribute: "data-min-upper-letter-message",
  check: (field) => {
    const fieldValue = getConstraintValue(field);
    const required = field.props.required;
    if (!fieldValue && !required) {
      return "";
    }
    const minAttribute = field.props["data-min-upper-letter"];
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
      if (min === 1) {
        return naviI18n(
          `constraint.min_upper_letter.singular.${fieldTypeSuffix(field)}`,
        );
      }
      return naviI18n(
        `constraint.min_upper_letter.plural.${fieldTypeSuffix(field)}`,
        {
          min: String(min),
        },
      );
    }
    return "";
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-min-upper-letter");

export const MIN_DIGIT_CONSTRAINT = {
  name: "min_digit",
  messageAttribute: "data-min-digit-message",
  check: (field) => {
    const fieldValue = getConstraintValue(field);
    const required = field.props.required;
    if (!fieldValue && !required) {
      return "";
    }
    const minAttribute = field.props["data-min-digit"];
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
      if (min === 1) {
        return naviI18n(
          `constraint.min_digit.singular.${fieldTypeSuffix(field)}`,
        );
      }
      return naviI18n(`constraint.min_digit.plural.${fieldTypeSuffix(field)}`, {
        min: String(min),
      });
    }
    return "";
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-min-digit");

export const MIN_SPECIAL_CHAR_CONSTRAINT = {
  name: "min_special_char",
  messageAttribute: "data-min-special-char-message",
  check: (field) => {
    const fieldValue = getConstraintValue(field);
    const required = field.props.required;
    if (!fieldValue && !required) {
      return "";
    }
    const minSpecialChars = field.props["data-min-special-char"];
    if (!minSpecialChars) {
      return "";
    }
    const min = parseInt(minSpecialChars, 10);
    const specialCharset = field.props["data-special-charset"];
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
        return naviI18n(
          `constraint.min_special_char.singular.${fieldTypeSuffix(field)}`,
          { charset: specialCharset },
        );
      }
      return naviI18n(
        `constraint.min_special_char.plural.${fieldTypeSuffix(field)}`,
        { min: String(min), charset: specialCharset },
      );
    }
    return "";
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-special-charset");
CONSTRAINT_ATTRIBUTE_SET.add("data-min-special-char");
