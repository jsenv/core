/**
 * `data-no-emoji` — an app is free with emoji or it is not, and that is not the
 * layout's call: a row survives an emoji, a legal name, an identifier or a
 * title may still not want one. So it is its own switch rather than a part of
 * `data-displayable`.
 *
 * The rule is @jsenv/validity's NO_EMOJI_RULE. To refuse the keystroke instead
 * of the value, `charGuard="noEmoji"` is the same knowledge on the other side.
 */

import { NO_EMOJI_RULE } from "@jsenv/validity";

import {
  CONSTRAINT_ATTRIBUTE_SET,
  isConstraintAttributeOn,
} from "../constraint_attribute_set.js";
import { naviI18nFromValidityMessage } from "../validity_bridge.js";

export const NO_EMOJI_CONSTRAINT = {
  name: "no_emoji",
  messageAttribute: "data-no-emoji-message",
  check: (field) => {
    const noEmoji = field.controlHostProps["data-no-emoji"];
    if (!isConstraintAttributeOn(noEmoji)) {
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    const result = NO_EMOJI_RULE.applyOn(true, valueAsString);
    if (!result) {
      return null;
    }
    return naviI18nFromValidityMessage(result);
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-no-emoji");
