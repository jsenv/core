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

export const DISABLED_CONSTRAINT = {
  name: "disabled",
  messageAttribute: "data-disabled-message",
  check: (field) => {
    const disabled = field.controlHostProps.disabled;
    if (!disabled) {
      return null;
    }

    const type = field.controlHostProps.type;
    let message;
    if (type === "radio") {
      message = naviI18n(`constraint.disabled.radio`);
    } else if (type === "checkbox") {
      message = naviI18n(`constraint.disabled.checkbox`);
    } else {
      message = naviI18n(`constraint.disabled.default`);
    }
    // A disabled element does not block its parent from submitting.
    return { message, status: "info", ignoredByParents: true };
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("disabled");
CONSTRAINT_ATTRIBUTE_SET.add("data-disabled");
