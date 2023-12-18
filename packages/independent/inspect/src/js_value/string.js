import { escapeTemplateStringSpecialCharacters } from "../utils.js";

const DOUBLE_QUOTE = `"`;
const SINGLE_QUOTE = `'`;
const BACKTICK = "`";

export const inspectString = (
  value,
  {
    quote = "auto",
    canUseTemplateString = false,
    preserveLineBreaks = false,
    quoteDefault = DOUBLE_QUOTE,
  } = {},
) => {
  quote =
    quote === "auto"
      ? determineQuote(value, { canUseTemplateString, quoteDefault })
      : quote;
  if (quote === BACKTICK) {
    return `\`${escapeTemplateStringSpecialCharacters(value)}\``;
  }
  return surroundStringWith(value, { quote, preserveLineBreaks });
};

export const determineQuote = (
  string,
  { canUseTemplateString, quoteDefault = DOUBLE_QUOTE } = {},
) => {
  const containsDoubleQuote = string.includes(DOUBLE_QUOTE);
  if (!containsDoubleQuote) {
    return DOUBLE_QUOTE;
  }
  const containsSimpleQuote = string.includes(SINGLE_QUOTE);
  if (!containsSimpleQuote) {
    return SINGLE_QUOTE;
  }
  if (canUseTemplateString) {
    const containsBackTick = string.includes(BACKTICK);
    if (!containsBackTick) {
      return BACKTICK;
    }
  }
  const doubleQuoteCount = string.split(DOUBLE_QUOTE).length - 1;
  const singleQuoteCount = string.split(SINGLE_QUOTE).length - 1;
  if (singleQuoteCount > doubleQuoteCount) {
    return DOUBLE_QUOTE;
  }
  if (doubleQuoteCount > singleQuoteCount) {
    return SINGLE_QUOTE;
  }
  return quoteDefault;
};

export const inspectChar = (char, { quote, preserveLineBreaks }) => {
  const point = char.charCodeAt(0);
  if (preserveLineBreaks && (char === "\n" || char === "\r")) {
    return char;
  }
  if (
    char === quote ||
    point === 92 ||
    point < 32 ||
    (point > 126 && point < 160) ||
    // line separators
    point === 8232 ||
    point === 8233
  ) {
    const replacement =
      char === quote
        ? `\\${quote}`
        : point === 8232
          ? "\\u2028"
          : point === 8233
            ? "\\u2029"
            : meta[point];
    return replacement;
  }
  return char;
};

// https://github.com/jsenv/jsenv-uneval/blob/6c97ef9d8f2e9425a66f2c88347e0a118d427f3a/src/internal/escapeString.js#L3
// https://github.com/jsenv/jsenv-inspect/blob/bb11de3adf262b68f71ed82b0a37d4528dd42229/src/internal/string.js#L3
// https://github.com/joliss/js-string-escape/blob/master/index.js
// http://javascript.crockford.com/remedial.html
const surroundStringWith = (string, { quote, preserveLineBreaks }) => {
  let result = "";
  let last = 0;
  const lastIndex = string.length;
  let i = 0;
  while (i < lastIndex) {
    const char = string[i];
    const replacement = inspectChar(char, { quote, preserveLineBreaks });
    if (char !== replacement) {
      if (last === i) {
        result += replacement;
      } else {
        result += `${string.slice(last, i)}${replacement}`;
      }
      last = i + 1;
    }
    i++;
  }
  if (last !== lastIndex) {
    result += string.slice(last);
  }
  return `${quote}${result}${quote}`;
};

// prettier-ignore
const meta = [
  '\\x00', '\\x01', '\\x02', '\\x03', '\\x04', '\\x05', '\\x06', '\\x07', // x07
  '\\b', '\\t', '\\n', '\\x0B', '\\f', '\\r', '\\x0E', '\\x0F',           // x0F
  '\\x10', '\\x11', '\\x12', '\\x13', '\\x14', '\\x15', '\\x16', '\\x17', // x17
  '\\x18', '\\x19', '\\x1A', '\\x1B', '\\x1C', '\\x1D', '\\x1E', '\\x1F', // x1F
  '', '', '', '', '', '', '', "\\'", '', '', '', '', '', '', '', '',      // x2F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x3F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x4F
  '', '', '', '', '', '', '', '', '', '', '', '', '\\\\', '', '', '',     // x5F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',         // x6F
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '\\x7F',    // x7F
  '\\x80', '\\x81', '\\x82', '\\x83', '\\x84', '\\x85', '\\x86', '\\x87', // x87
  '\\x88', '\\x89', '\\x8A', '\\x8B', '\\x8C', '\\x8D', '\\x8E', '\\x8F', // x8F
  '\\x90', '\\x91', '\\x92', '\\x93', '\\x94', '\\x95', '\\x96', '\\x97', // x97
  '\\x98', '\\x99', '\\x9A', '\\x9B', '\\x9C', '\\x9D', '\\x9E', '\\x9F', // x9F
];
