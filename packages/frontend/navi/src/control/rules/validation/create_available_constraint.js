import { constraintI18n } from "@jsenv/navi/src/text/navi_i18n.js";

/**
 * A constraint refusing a value already taken — a name among the ones the app
 * holds. The set may be incomplete or late (a page rarely holds every item the
 * server has): it helps with what is known, and the server, which knows for
 * sure, says the rest with its response.
 *
 * @param {Set<any>} existingValueSet - The values taken.
 * @param {string} [message="constraint.available"] - The i18n key of the
 *   sentence (given `{ value }`), not the sentence itself: register it in
 *   naviI18n.
 * @returns {{ name: "available", check: (field: object) => string | null }}
 */
export const createAvailableConstraint = (
  existingValueSet,
  message = "constraint.available",
) => {
  return {
    name: "available",
    check: (field) => {
      const fieldValue = field.uiState;
      const hasConflict = existingValueSet.has(fieldValue);
      if (!hasConflict) {
        return null;
      }

      return constraintI18n(message, { value: fieldValue });
    },
  };
};
