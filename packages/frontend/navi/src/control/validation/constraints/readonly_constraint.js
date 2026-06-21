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
    const type = field.controlHostProps.type;
    if (type === "hidden") {
      return null;
    }

    const isButton = field.controlType === "button";
    const isBusy = field.controlHostProps["aria-busy"] === "true";
    const readonlySilent = field.controlHostProps["data-readonly-silent"] === "";
    if (readonlySilent) {
      return { silent: true };
    }
    const message = (() => {
      if (isBusy) {
        if (isButton) {
          return naviI18n("constraint.readonly.button_busy");
        }
        return naviI18n("constraint.readonly.busy");
      }
      if (isButton) {
        return naviI18n("constraint.readonly.button");
      }
      return naviI18n("constraint.readonly.default");
    })();
    return {
      message,
      status: "info",
    };
  },
};
// CONSTRAINT_ATTRIBUTE_SET.add("readOnly"); // not all control support this attr
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly");
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly-silent");
