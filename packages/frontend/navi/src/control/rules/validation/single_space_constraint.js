/**
 * `data-single-space` — no leading or trailing space, never two in a row.
 * The rule itself is @jsenv/validity's SINGLE_SPACE_RULE, so a server checking
 * the value again refuses it for the same reason and in the same words.
 */

import { SINGLE_SPACE_RULE } from "@jsenv/validity";

import {
  CONSTRAINT_ATTRIBUTE_SET,
  isConstraintAttributeOn,
} from "../constraint_attribute_set.js";
import { naviI18nFromValidityMessage } from "../validity_bridge.js";

export const SINGLE_SPACE_CONSTRAINT = {
  name: "single_space",
  messageAttribute: "data-single-space-message",
  check: (field) => {
    const singleSpace = field.controlHostProps["data-single-space"];
    if (!isConstraintAttributeOn(singleSpace)) {
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    const result = SINGLE_SPACE_RULE.applyOn(true, valueAsString);
    if (!result) {
      return null;
    }
    return naviI18nFromValidityMessage(result);
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-single-space");
