/**
 * The rules that answer « is this string acceptable ».
 *
 * None of them needs a DOM: a field asks them while someone types, a server
 * asks them again when the value arrives, and both get the same refusal for the
 * same reason. That is the whole point of them living here — written twice they
 * drift, and the day the server is the stricter of the two, a value the field
 * accepted comes back as an error after the fact.
 *
 * What a character class cannot express gets its own rule: `displayable` is
 * about what the layout can draw, `singleSpace` about how a value reads,
 * `maxLineBreaks` about how tall it may grow.
 */

import {
  compileCharClassAnchored,
  EMOJI_CHAR_CLASS,
  getCharClassMessageKey,
  resolveCharClass,
} from "./char_class.js";
import { message } from "./message.js";

export const MIN_LENGTH_RULE = {
  id: "minLength",
  applyOn: (minLength, value) => {
    if (typeof value !== "string" || value === "") {
      return null;
    }
    if (value.length >= minLength) {
      return null;
    }
    return message("min_length.default", {
      min: minLength,
      count: value.length,
    });
  },
};

export const MAX_LENGTH_RULE = {
  id: "maxLength",
  applyOn: (maxLength, value) => {
    if (typeof value !== "string") {
      return null;
    }
    if (value.length <= maxLength) {
      return null;
    }
    return {
      ...message("max_length.default", {
        max: maxLength,
        count: value.length,
      }),
      autoFix: () => value.slice(0, maxLength),
    };
  },
};

export const CHAR_CLASS_RULE = {
  id: "charClass",
  applyOn: (charClass, value) => {
    if (typeof value !== "string" || value === "") {
      return null;
    }
    const resolved = resolveCharClass(charClass);
    if (compileCharClassAnchored(resolved).test(value)) {
      return null;
    }
    return message(getCharClassMessageKey(charClass));
  },
};

// Above what any writing system needs on one base character, far below what
// zalgo uses. Raise it with `maxStackedMarks` when a language needs more.
const DEFAULT_MAX_STACKED_MARKS = 5;
// Everything that occupies no ink of its own: spaces, control and format
// characters, and combining marks (which draw on a base character, so a value
// made only of them has nothing to draw on).
const INK_LESS_REGEX = /[\p{White_Space}\p{Cc}\p{Cf}\p{M}]/gu;
// Two newlines are one blank line — a paragraph break; three are two.
const BLANK_LINES_REGEX = /\n[^\S\n]*\n[^\S\n]*\n/;
// U+200D (ZWJ) and U+200C (ZWNJ) are invisible, and both are legitimate: the
// first assembles 👨‍👩‍👧 and 🏳️‍🌈, the second separates two letters in Persian.
// What they cannot do is join nothing — sit at either end of the value or
// against a space, where the only thing they add is an invisible character.
const DANGLING_JOINER_REGEX =
  /^[\u200c\u200d]|[\u200c\u200d]$|\s[\u200c\u200d]|[\u200c\u200d]\s/u;

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

export const DISPLAYABLE_RULE = {
  id: "displayable",
  applyOn: (displayable, value, ruleConfig = {}) => {
    if (!displayable || typeof value !== "string" || value === "") {
      return null;
    }
    const { maxStackedMarks = DEFAULT_MAX_STACKED_MARKS } = ruleConfig;
    if (getStackedMarksRegex(maxStackedMarks).test(value)) {
      return message("displayable.stacked_marks", { max: maxStackedMarks });
    }
    if (value.replace(INK_LESS_REGEX, "") === "") {
      return message("displayable.invisible");
    }
    if (BLANK_LINES_REGEX.test(value)) {
      return message("displayable.blank_lines");
    }
    if (DANGLING_JOINER_REGEX.test(value)) {
      return message("displayable.dangling_joiner");
    }
    return null;
  },
};

export const SINGLE_SPACE_RULE = {
  id: "singleSpace",
  applyOn: (singleSpace, value) => {
    if (!singleSpace || typeof value !== "string" || value === "") {
      return null;
    }
    const autoFix = () => value.replace(/^ +| +$/g, "").replace(/ {2,}/g, " ");
    if (value.startsWith(" ")) {
      return { ...message("single_space.start"), autoFix };
    }
    if (value.endsWith(" ")) {
      return { ...message("single_space.end"), autoFix };
    }
    if (value.includes("  ")) {
      return { ...message("single_space.consecutive"), autoFix };
    }
    return null;
  },
};

// An app is free with emoji or it is not, and that is not the layout's call —
// a row survives an emoji, a legal name and an identifier do not want one. So
// this is its own rule rather than a part of `displayable`.
const EMOJI_REGEX = new RegExp(EMOJI_CHAR_CLASS, "u");

export const NO_EMOJI_RULE = {
  id: "noEmoji",
  applyOn: (noEmoji, value) => {
    if (!noEmoji || typeof value !== "string" || value === "") {
      return null;
    }
    if (!EMOJI_REGEX.test(value)) {
      return null;
    }
    return message("no_emoji.default");
  },
};

const LINE_BREAK_REGEX = /\r\n|\r|\n/;

// Counted in line breaks rather than in lines: how many lines a value renders
// as depends on wrapping, which is the layout's answer, not the value's.
export const MAX_LINE_BREAKS_RULE = {
  id: "maxLineBreaks",
  applyOn: (maxLineBreaks, value) => {
    if (typeof value !== "string" || value === "") {
      return null;
    }
    const lines = value.split(LINE_BREAK_REGEX);
    const lineBreakCount = lines.length - 1;
    if (lineBreakCount <= maxLineBreaks) {
      return null;
    }
    return {
      ...message("max_line_breaks.default", {
        max: maxLineBreaks,
        count: lineBreakCount,
      }),
      autoFix: () => lines.slice(0, maxLineBreaks + 1).join("\n"),
    };
  },
};
