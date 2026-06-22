import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

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
