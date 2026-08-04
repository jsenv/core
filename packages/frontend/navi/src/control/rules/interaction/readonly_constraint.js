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

    // A readonly element does not block its parent from submitting — mirrors
    // standard HTML form behaviour where readonly inputs are submitted as-is.
    return {
      message: readOnlyMessage(field),
      status: "info",
      ignoredByParents: true,
    };
  },
};
// CONSTRAINT_ATTRIBUTE_SET.add("readOnly"); // not all control support this attr
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly");

const readOnlyMessage = (field) => {
  if (field.controlType !== "button") {
    return naviI18n("constraint.readonly.default");
  }
  // A send button held back by the form above it, which has nothing new to send
  // (see Form's own `sendUnchanged`): what stops the press is not the button,
  // it is the form still waiting for a change, so that is what it says.
  if (field.parentUIStateController?.nothingToSend) {
    return naviI18n("constraint.readonly.awaiting_change");
  }
  return naviI18n("constraint.readonly.button");
};
