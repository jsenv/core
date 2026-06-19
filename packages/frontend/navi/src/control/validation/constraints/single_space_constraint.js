import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";
import { getConstraintValue } from "./constraint_message_util.js";

export const SINGLE_SPACE_CONSTRAINT = {
  name: "single_space",
  messageAttribute: "data-single-space-message",
  check: (field) => {
    const singleSpace =
      field.props !== undefined
        ? field.props["data-single-space"] != null
        : field.hasAttribute("data-single-space");
    if (!singleSpace) {
      return null;
    }
    const fieldValue = getConstraintValue(field);
    const hasLeadingSpace = fieldValue.startsWith(" ");
    const hasTrailingSpace = fieldValue.endsWith(" ");
    const hasDoubleSpace = fieldValue.includes("  ");
    if (hasLeadingSpace || hasDoubleSpace || hasTrailingSpace) {
      if (hasLeadingSpace) {
        return naviI18n("constraint.single_space.start.default");
      }
      if (hasTrailingSpace) {
        return naviI18n("constraint.single_space.end.default");
      }
      return naviI18n("constraint.single_space.consecutive.default");
    }
    return "";
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-single-space");
