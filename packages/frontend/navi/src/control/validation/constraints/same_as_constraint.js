import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

export const SAME_AS_CONSTRAINT = {
  name: "same_as",
  messageAttribute: "data-same-as-message",
  check: (field) => {
    const sameAs = field.props["data-same-as"];
    if (sameAs === undefined) {
      return null;
    }
    // Ideally we should get the sameAs using the state controller id to avoid relying on DOM here too
    const otherField = document.querySelector(sameAs);
    if (!otherField) {
      console.warn(
        `Same as constraint: could not find element for selector ${sameAs}`,
      );
      return null;
    }
    const otherFieldValue = otherField.value;
    if (!otherFieldValue) {
      // Reference field is empty — nothing to compare against yet.
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (valueAsString === otherFieldValue) {
      return null;
    }
    const type = field.props.type;
    // sameAs implies the field must be filled — no need for required on a confirm field.
    if (!valueAsString) {
      if (type === "password") {
        return naviI18n("constraint.same_as.missing.password");
      }
      if (type === "email") {
        return naviI18n("constraint.same_as.missing.email");
      }
      return naviI18n("constraint.same_as.missing.default");
    }
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
