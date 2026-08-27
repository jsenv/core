/**
 * `data-max-line-breaks` — how many line breaks the value may hold. Counted in
 * breaks rather than in lines because how many lines a value renders as depends
 * on wrapping, which is the layout's answer, not the value's.
 *
 * The rule is @jsenv/validity's MAX_LINE_BREAKS_RULE — a textarea in the
 * browser and a server receiving the value both ask it.
 */

import { MAX_LINE_BREAKS_RULE } from "@jsenv/validity";

import {
  CONSTRAINT_ATTRIBUTE_SET,
  isConstraintAttributeOn,
} from "../constraint_attribute_set.js";
import { naviI18nFromValidityMessage } from "../validity_bridge.js";

export const MAX_LINE_BREAKS_CONSTRAINT = {
  name: "max_line_breaks",
  messageAttribute: "data-max-line-breaks-message",
  check: (field) => {
    const maxLineBreaksAttribute =
      field.controlHostProps["data-max-line-breaks"];
    if (!isConstraintAttributeOn(maxLineBreaksAttribute)) {
      return null;
    }
    const maxLineBreaks = parseInt(maxLineBreaksAttribute, 10);
    if (isNaN(maxLineBreaks)) {
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    const result = MAX_LINE_BREAKS_RULE.applyOn(maxLineBreaks, valueAsString);
    if (!result) {
      return null;
    }
    return naviI18nFromValidityMessage(result);
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-max-line-breaks");
