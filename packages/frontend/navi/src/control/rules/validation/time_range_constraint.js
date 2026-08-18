import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

// The one rule a span of time always has: it ends after it starts. Carried by
// the group holding both times rather than by either of them — neither is
// wrong on its own, it is the pair that does not hold together.
export const TIME_RANGE_CONSTRAINT = {
  name: "time_range",
  messageAttribute: "data-time-range-message",
  check: (field) => {
    if (field.controlHostProps["data-time-range"] === undefined) {
      return null;
    }
    const value = field.uiState;
    if (!value || typeof value !== "object") {
      return null;
    }
    const { start, end } = value;
    if (!start || !end) {
      return null;
    }
    // "HH:MM" against "HH:MM": written that way, the order of two times IS
    // their alphabetical order.
    if (end > start) {
      return null;
    }
    return naviI18n("constraint.time_range.default");
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-time-range");
