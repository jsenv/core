import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const READONLY_CONSTRAINT = {
  name: "readonly",
  messageAttribute: "data-readonly-message",
  check: (field, { skipReadonly }) => {
    if (skipReadonly) {
      return null;
    }
    if (
      !field.readOnly &&
      !field.hasAttribute("data-readonly") &&
      field.getAttribute("aria-readonly") !== "true"
    ) {
      return null;
    }
    if (field.type === "hidden") {
      return null;
    }
    const isButton = field.tagName === "BUTTON";
    const isBusy = field.getAttribute("aria-busy") === "true";
    const readonlySilent = field.hasAttribute("data-readonly-silent");
    if (readonlySilent) {
      return { silent: true };
    }
    if (isBusy) {
      return {
        target: field,
        message: isButton
          ? naviI18n("constraint.readonly.button_busy")
          : naviI18n("constraint.readonly.busy"),
        status: "info",
      };
    }
    return {
      target: field,
      message: isButton
        ? naviI18n("constraint.readonly.button")
        : naviI18n("constraint.readonly.default"),
      status: "info",
    };
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("readOnly");
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly");
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly-message");
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly-silent");
