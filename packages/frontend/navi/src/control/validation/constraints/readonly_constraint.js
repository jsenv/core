import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const READONLY_CONSTRAINT = {
  name: "readonly",
  messageAttribute: "data-readonly-message",
  // Readonly is an interaction constraint: it controls whether the user can
  // interact with the element and what callout to show, but it does not count
  // as a value-validity failure (the element's value is still valid).
  interactionOnly: true,
  check: (field) => {
    const readOnly = Boolean(
      field.controlHostProps.readOnly ||
      field.controlHostProps["aria-readonly"] === "true",
    );
    if (!readOnly) {
      return null;
    }
    const type = field.controlHostProps.type;
    if (type === "hidden") {
      return null;
    }
    const readonlySilent =
      field.controlHostProps["data-readonly-silent"] === "";
    if (readonlySilent) {
      return { silent: true };
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
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly-silent");
