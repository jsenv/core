import { escapeStringSpecialChars } from "./escape_string_special_chars.js"
import { escapeChars } from "./escape_chars.js"

const QUOTES = {
  DOUBLE: `"`,
  SINGLE: `'`,
  BACKTICK: "`",
}

export const jsStringFromString = (
  value,
  {
    quote = "auto",
    canUseTemplateString = true,
    defaultQuote = QUOTES.DOUBLE,
  } = {},
) => {
  quote =
    quote === "auto"
      ? determineQuote(value, { canUseTemplateString, defaultQuote })
      : quote
  if (quote === QUOTES.BACKTICK) {
    // https://github.com/mgenware/string-to-template-literal/blob/main/src/main.ts#L1
    return `\`${escapeChars(value, {
      "\\": "\\\\",
      "`": "\\`",
      "$": "\\$",
    })}\``
  }
  return `${quote}${escapeStringSpecialChars(value)}${quote}`
}

const determineQuote = (string, { canUseTemplateString, defaultQuote }) => {
  // check default first, once tested do no re-test it
  if (!string.includes(defaultQuote)) {
    return defaultQuote
  }
  if (defaultQuote !== QUOTES.DOUBLE && !string.includes(QUOTES.DOUBLE)) {
    return QUOTES.DOUBLE
  }
  if (defaultQuote !== QUOTES.SINGLE && !string.includes(QUOTES.SINGLE)) {
    return QUOTES.SINGLE
  }
  if (
    canUseTemplateString &&
    defaultQuote !== QUOTES.BACKTICK &&
    !string.includes(QUOTES.BACKTICK)
  ) {
    return QUOTES.BACKTICK
  }
  return defaultQuote
}
