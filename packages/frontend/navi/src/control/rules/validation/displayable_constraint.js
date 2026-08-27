/**
 * `data-displayable` — the value must be something the layout can actually
 * draw. Three shapes break a row, a card or a list even though every character
 * taken alone is legitimate, so no character class can express them:
 *
 * - marks stacked on one base character ("zalgo"): a diacritic is a normal
 *   character — a decomposed Vietnamese letter carries two, a vocalized Hebrew
 *   one three — what is not normal is the count in a row. Thirty of them draw
 *   far above the line, over the row above.
 * - a value that is not empty and yet shows nothing: only spaces, only marks,
 *   only format characters. An empty-looking line in the middle of a list
 *   reads as a bug.
 * - blank lines in series: forty newlines make a card as tall as the screen.
 *
 * These are display rules, not app rules: they hold for every field, whatever
 * it holds — which is why they ship here rather than being rewritten per app.
 *
 * Note what is deliberately NOT refused: U+200D (ZWJ) and U+200C (ZWNJ) are
 * invisible characters, but the first assembles 👨‍👩‍👧 and 🏳️‍🌈 and the second
 * separates two letters in Persian. Banning invisible characters outright
 * would mean banning composed emoji. They only make a value fail here when
 * nothing visible is left once they are removed.
 */

import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

// Above what any writing system needs on one base character, far below what
// zalgo uses. Raise it with data-max-stacked-marks when a language needs more.
const DEFAULT_MAX_STACKED_MARKS = 5;

// Everything that occupies no ink of its own: spaces, control and format
// characters, and combining marks (which draw on a base character, so a value
// made only of them has nothing to draw on).
const INK_LESS_REGEX = /[\p{White_Space}\p{Cc}\p{Cf}\p{M}]/gu;
// Two newlines are one blank line — a paragraph break; three are two.
const BLANK_LINES_REGEX = /\n[^\S\n]*\n[^\S\n]*\n/;

const stackedMarksRegexCache = new Map();
const getStackedMarksRegex = (maxStackedMarks) => {
  const fromCache = stackedMarksRegexCache.get(maxStackedMarks);
  if (fromCache) {
    return fromCache;
  }
  const regex = new RegExp(`\\p{M}{${maxStackedMarks + 1},}`, "u");
  stackedMarksRegexCache.set(maxStackedMarks, regex);
  return regex;
};

export const DISPLAYABLE_CONSTRAINT = {
  name: "displayable",
  messageAttribute: "data-displayable-message",
  check: (field) => {
    const displayable = field.controlHostProps["data-displayable"];
    if (displayable === undefined) {
      return null;
    }
    const valueAsString =
      field.uiState === undefined ? "" : String(field.uiState);
    if (valueAsString === "") {
      // An empty field is `required`'s business, not this one's.
      return null;
    }

    const maxStackedMarksAttribute =
      field.controlHostProps["data-max-stacked-marks"];
    const maxStackedMarks =
      maxStackedMarksAttribute === undefined
        ? DEFAULT_MAX_STACKED_MARKS
        : parseInt(maxStackedMarksAttribute, 10);
    if (getStackedMarksRegex(maxStackedMarks).test(valueAsString)) {
      return naviI18n("constraint.displayable.stacked_marks.default", {
        max: maxStackedMarks,
      });
    }
    if (valueAsString.replace(INK_LESS_REGEX, "") === "") {
      return naviI18n("constraint.displayable.invisible.default");
    }
    if (BLANK_LINES_REGEX.test(valueAsString)) {
      return naviI18n("constraint.displayable.blank_lines.default");
    }
    return null;
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-displayable");
CONSTRAINT_ATTRIBUTE_SET.add("data-max-stacked-marks");
