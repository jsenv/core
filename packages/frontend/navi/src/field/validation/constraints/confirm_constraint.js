import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

CONSTRAINT_ATTRIBUTE_SET.add("data-confirm");

export const CONFIRM_CONSTRAINT = {
  name: "confirm",
  // messageAttribute: "data-confirm-message",
  check: (field) => {
    const messageAttribute = field.getAttribute("data-confirm");
    if (!messageAttribute) {
      return "";
    }
    // eslint-disable-next-line no-alert
    if (window.confirm(messageAttribute)) {
      return "";
    }
    return "";
  },
};
