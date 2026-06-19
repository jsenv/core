import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { getConstraintValue } from "./constraint_message_util.js";

export const createAvailableConstraint = (
  // the set might be incomplete (the front usually don't have the full copy of all the items from the backend)
  // but this is already nice to help user with what we know
  // it's also possible that front is unsync with backend, preventing user to choose a value
  // that is actually free.
  // But this is unlikely to happen and user could reload the page to be able to choose that name
  // that suddenly became available
  existingValueSet,
  message = "constraint.available",
) => {
  return {
    name: "available",
    messageAttribute: "data-available-message",
    check: (field) => {
      const fieldValue = getConstraintValue(field);
      const hasConflict = existingValueSet.has(fieldValue);
      if (hasConflict) {
        return naviI18n(message, { value: fieldValue });
      }
      return "";
    },
  };
};
