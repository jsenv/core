import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const BUSY_CONSTRAINT = {
  name: "busy",
  messageAttribute: "data-busy-message",
  // Unlike readonly/disabled, a busy element DOES block its parent from
  // submitting — the element is mid-operation and cannot safely participate.
  check: (field) => {
    const isBusy = field.controlHostProps["aria-busy"] === "true";
    if (!isBusy) {
      return null;
    }

    const isButton = field.controlType === "button";
    const message = isButton
      ? naviI18n("constraint.busy.button")
      : naviI18n("constraint.busy.default");
    return { message, status: "info" };
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-busy");
