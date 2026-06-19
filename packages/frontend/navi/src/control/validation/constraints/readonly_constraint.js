import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const READONLY_CONSTRAINT = {
  name: "readonly",
  messageAttribute: "data-readonly-message",
  check: (field, { skipReadonly }) => {
    if (skipReadonly) {
      return null;
    }
    const readOnly = Boolean(
      field.props.readOnly ||
      field.props["data-readonly"] === "" ||
      field.props["aria-readonly"] === "true",
    );
    if (!readOnly) {
      return null;
    }
    const type = field.props.type;
    if (type === "hidden") {
      return null;
    }
    const isButton = field.controlType === "button";
    const isBusy = field.props["aria-busy"] === "true";
    const readonlySilent = field.props["data-readonly-silent"] === "";
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
CONSTRAINT_ATTRIBUTE_SET.add("readOnly");
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly");
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly-silent");
