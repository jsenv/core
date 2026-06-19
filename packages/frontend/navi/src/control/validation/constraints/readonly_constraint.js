import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const READONLY_CONSTRAINT = {
  name: "readonly",
  messageAttribute: "data-readonly-message",
  check: (field, { skipReadonly }) => {
    if (skipReadonly) {
      return null;
    }
    const readOnly =
      field.props !== undefined
        ? Boolean(
            field.props.readOnly ||
            field.props["data-readonly"] != null ||
            field.props["aria-readonly"] === "true",
          )
        : field.readOnly ||
          field.hasAttribute("data-readonly") ||
          field.getAttribute("aria-readonly") === "true";
    if (!readOnly) {
      return null;
    }
    const type = field.props?.type ?? field.type ?? "";
    if (type === "hidden") {
      return null;
    }
    const isButton =
      field.controlType === "button" || field.tagName === "BUTTON";
    const isBusy =
      field.props !== undefined
        ? field.props["aria-busy"] === "true"
        : field.getAttribute("aria-busy") === "true";
    const readonlySilent =
      field.props !== undefined
        ? field.props["data-readonly-silent"] != null
        : field.hasAttribute("data-readonly-silent");
    if (readonlySilent) {
      return { silent: true };
    }
    const target = field.elementRef?.current ?? field;
    if (isBusy) {
      return {
        target,
        message: isButton
          ? naviI18n("constraint.readonly.button_busy")
          : naviI18n("constraint.readonly.busy"),
        status: "info",
      };
    }
    return {
      target,
      message: isButton
        ? naviI18n("constraint.readonly.button")
        : naviI18n("constraint.readonly.default"),
      status: "info",
    };
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("readOnly");
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly");
CONSTRAINT_ATTRIBUTE_SET.add("data-readonly-silent");
