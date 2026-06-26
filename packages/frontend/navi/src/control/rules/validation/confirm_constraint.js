import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const CONFIRM_CONSTRAINT = {
  name: "confirm",
  // messageAttribute: "data-confirm-message",
  check: (field) => {
    const confirmAttribute = field.controlHostProps["data-confirm"];
    if (!confirmAttribute) {
      return "";
    }
    // eslint-disable-next-line no-alert
    if (window.confirm(confirmAttribute)) {
      return "";
    }
    return "";
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-confirm");
