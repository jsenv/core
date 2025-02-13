import { escapeChars } from "./escape_chars.js";

// https://github.com/benjamingr/RegExp.escape/blob/master/polyfill.js

export const escapeRegexpSpecialChars = (string) => {
  return escapeChars(String(string), {
    "/": "\\/",
    "^": "\\^",
    "\\": "\\\\",
    "[": "\\[",
    "]": "\\]",
    "(": "\\(",
    ")": "\\)",
    "{": "\\{",
    "}": "\\}",
    "?": "\\?",
    "+": "\\+",
    "*": "\\*",
    ".": "\\.",
    "|": "\\|",
    "$": "\\$",
  });
};
