import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const SINGLE_SPACE_CONSTRAINT = {
  name: "single_space",
  messageAttribute: "data-single-space-message",
  check: (field) => {
    const singleSpace = field.controlHostProps["data-single-space"];
    if (singleSpace === undefined) {
      return null;
    }

    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    const hasLeadingSpace = valueAsString.startsWith(" ");
    const hasTrailingSpace = valueAsString.endsWith(" ");
    const hasDoubleSpace = valueAsString.includes("  ");
    if (!hasLeadingSpace && !hasTrailingSpace && !hasDoubleSpace) {
      return null;
    }
    if (hasLeadingSpace) {
      return naviI18n("constraint.single_space.start.default");
    }
    if (hasTrailingSpace) {
      return naviI18n("constraint.single_space.end.default");
    }
    return naviI18n("constraint.single_space.consecutive.default");
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-single-space");
