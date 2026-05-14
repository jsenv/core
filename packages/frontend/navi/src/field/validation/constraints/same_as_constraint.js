import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const SAME_AS_CONSTRAINT = {
  name: "same_as",
  messageAttribute: "data-same-as-message",
  check: (field) => {
    const sameAs = field.getAttribute("data-same-as");
    if (!sameAs) {
      return null;
    }
    const otherField = document.querySelector(sameAs);
    if (!otherField) {
      console.warn(
        `Same as constraint: could not find element for selector ${sameAs}`,
      );
      return null;
    }
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return null;
    }
    const otherFieldValue = otherField.value;
    if (!otherFieldValue && !otherField.required) {
      // don't validate if one of the two values is empty
      return null;
    }
    if (fieldValue === otherFieldValue) {
      return null;
    }
    const type = field.type;
    if (type === "password") {
      return naviI18n("constraint.same_as.password");
    }
    if (type === "email") {
      return naviI18n("constraint.same_as.email");
    }
    return naviI18n("constraint.same_as.default");
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-same-as");
CONSTRAINT_ATTRIBUTE_SET.add("data-same-as-message");
