/**
 * `data-single-space` — no leading or trailing space, never two in a row.
 * The rule itself is @jsenv/validity's SINGLE_SPACE_RULE, so a server checking
 * the value again refuses it for the same reason and in the same words.
 *
 * `data-single-space="autoFix"` corrects the value instead of refusing it. A
 * text field ends with a space more often than anyone means it to — a word
 * then a pause, a mobile keyboard after a suggestion, a paste — and the person
 * is then asked to find and delete a character they cannot see. The correction
 * is the rule's own, so the value a server re-checks with `singleSpace: true`
 * is one it accepts.
 */

import { SINGLE_SPACE_RULE } from "@jsenv/validity";

import {
  CONSTRAINT_ATTRIBUTE_SET,
  isConstraintAttributeAutoFix,
  isConstraintAttributeOn,
} from "../constraint_attribute_set.js";
import { naviI18nFromValidityMessage } from "../validity_bridge.js";
import { uiStateAsText } from "../ui_state_as_text.js";

const applyRule = (field) => {
  const valueAsString = uiStateAsText(field.uiState);
  return SINGLE_SPACE_RULE.applyOn(true, valueAsString);
};

export const SINGLE_SPACE_CONSTRAINT = {
  name: "single_space",
  messageAttribute: "data-single-space-message",
  check: (field) => {
    const singleSpace = field.controlHostProps["data-single-space"];
    if (!isConstraintAttributeOn(singleSpace)) {
      return null;
    }
    if (isConstraintAttributeAutoFix(singleSpace)) {
      // The correction the rule knows always lands on a value the rule
      // accepts, and it runs on every commit — so there is nothing left for
      // the person to do about this, and nothing to say to them.
      return null;
    }
    const result = applyRule(field);
    if (!result) {
      return null;
    }
    return naviI18nFromValidityMessage(result);
  },
  autoFix: (field) => {
    const singleSpace = field.controlHostProps["data-single-space"];
    if (!isConstraintAttributeAutoFix(singleSpace)) {
      return null;
    }
    const result = applyRule(field);
    if (!result) {
      return null;
    }
    return result.autoFix();
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-single-space");
