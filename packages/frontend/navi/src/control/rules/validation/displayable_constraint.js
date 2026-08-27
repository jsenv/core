/**
 * `data-displayable` — the value must be something the layout can actually
 * draw. What it refuses and why lives in @jsenv/validity's DISPLAYABLE_RULE:
 * these are display rules, not app rules, so a server re-checking the value
 * asks the exact same question and gets the exact same refusal.
 *
 * `data-max-stacked-marks` raises how many marks may stack on one base
 * character, for a language that needs more than the default.
 */

import { DISPLAYABLE_RULE } from "@jsenv/validity";

import {
  CONSTRAINT_ATTRIBUTE_SET,
  isConstraintAttributeOn,
} from "../constraint_attribute_set.js";
import { naviI18nFromValidityMessage } from "../validity_bridge.js";

export const DISPLAYABLE_CONSTRAINT = {
  name: "displayable",
  messageAttribute: "data-displayable-message",
  check: (field) => {
    const displayable = field.controlHostProps["data-displayable"];
    if (!isConstraintAttributeOn(displayable)) {
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    const maxStackedMarksAttribute =
      field.controlHostProps["data-max-stacked-marks"];
    const result = DISPLAYABLE_RULE.applyOn(true, valueAsString, {
      maxStackedMarks:
        maxStackedMarksAttribute === undefined
          ? undefined
          : parseInt(maxStackedMarksAttribute, 10),
    });
    if (!result) {
      return null;
    }
    return naviI18nFromValidityMessage(result);
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-displayable");
CONSTRAINT_ATTRIBUTE_SET.add("data-max-stacked-marks");
