import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const READONLY_CONSTRAINT = {
  name: "readonly",
  messageAttribute: "data-readonly-message",
  check: (field) => {
    const readOnly = Boolean(
      field.controlHostProps.readOnly ||
      field.controlHostProps["aria-readonly"] === "true",
    );
    if (!readOnly) {
      return null;
    }

    const isButton = field.controlType === "button";
    const message = isButton
      ? naviI18n("constraint.readonly.button")
      : naviI18n("constraint.readonly.default");
    // A readonly element does not block its parent from submitting — mirrors
    // standard HTML form behaviour where readonly inputs are submitted as-is.
    return { message, status: "info", ignoredByParents: true };
  },
};
// CONSTRAINT_ATTRIBUTE_SET.add("readOnly"); // not all control support this attr
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly");
