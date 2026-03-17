import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";
import { generateFieldInvalidMessage } from "./constraint_message_util.js";

export const SINGLE_SPACE_CONSTRAINT = {
  name: "single_space",
  messageAttribute: "data-single-space-message",
  check: (field) => {
    const singleSpace = field.hasAttribute("data-single-space");
    if (!singleSpace) {
      return null;
    }
    const fieldValue = field.value;
    const hasLeadingSpace = fieldValue.startsWith(" ");
    const hasTrailingSpace = fieldValue.endsWith(" ");
    const hasDoubleSpace = fieldValue.includes("  ");
    if (hasLeadingSpace || hasDoubleSpace || hasTrailingSpace) {
      if (hasLeadingSpace) {
        return generateFieldInvalidMessage(
          `{field} ne doit pas commencer par un espace.`,
          { field },
        );
      }
      if (hasTrailingSpace) {
        return generateFieldInvalidMessage(
          `{field} ne doit pas finir par un espace.`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} ne doit pas contenir plusieurs espaces consécutifs.`,
        { field },
      );
    }
    return "";
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-single-space");
CONSTRAINT_ATTRIBUTE_SET.add("data-single-space-message");
