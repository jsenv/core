const DOUBLE_QUOTE = `"`
const SINGLE_QUOTE = `'`
const BACKTICK = "`"

export const escapeString = (
  value,
  {
    quote = "auto",
    canUseTemplateString = true,
    fallback = DOUBLE_QUOTE,
    escapeInternalQuotes = true,
    escapeLines = true,
  } = {},
) => {
  quote =
    quote === "auto"
      ? determineQuote(value, canUseTemplateString) || fallback
      : quote
  if (quote === BACKTICK) {
    return `\`${escapeTemplateString(value)}`
  }
  return surroundStringWith(value, { quote, escapeLines, escapeInternalQuotes })
}

// https://github.com/mgenware/string-to-template-literal/blob/main/src/main.ts#L1

const escapeTemplateString = (string) => {
  string = String(string)
  let i = 0
  let escapedString = ""
  while (i < string.length) {
    const char = string[i]
    i++
    escapedString += isTemplateStringSpecialChar(char) ? `\\${char}` : char
  }
  return `${BACKTICK}${escapedString}${BACKTICK}`
}
const isTemplateStringSpecialChar = (char) =>
  templateStringSpecialChars.indexOf(char) > -1
const templateStringSpecialChars = ["\\", "`", "$"]

const determineQuote = (string, canUseTemplateString) => {
  const containsDoubleQuote = string.includes(DOUBLE_QUOTE)
  if (!containsDoubleQuote) {
    return DOUBLE_QUOTE
  }
  const containsSimpleQuote = string.includes(SINGLE_QUOTE)
  if (!containsSimpleQuote) {
    return SINGLE_QUOTE
  }
  if (canUseTemplateString) {
    const containsBackTick = string.includes(BACKTICK)
    if (!containsBackTick) {
      return BACKTICK
    }
  }
  return null
}

// https://github.com/jsenv/jsenv-uneval/blob/6c97ef9d8f2e9425a66f2c88347e0a118d427f3a/src/internal/escapeString.js#L3
// https://github.com/jsenv/jsenv-inspect/blob/bb11de3adf262b68f71ed82b0a37d4528dd42229/src/internal/string.js#L3
// https://github.com/joliss/js-string-escape/blob/master/index.js
// http://javascript.crockford.com/remedial.html
const surroundStringWith = (
  string,
  { quote, escapeLines, escapeInternalQuotes },
) => {
  let escapedString = ""
  let i = 0
  while (i < string.length) {
    const char = string[i]
    i++
    let needEscape = false
    if (escapeInternalQuotes && char === quote) {
      needEscape = true
    } else if (
      escapeLines &&
      (char === "\n" || char === "\r" || char === "\u2028" || char === "\u2029")
    ) {
      needEscape = true
    }
    escapedString += needEscape ? `\\${char}` : char
  }
  return `${quote}${escapedString}${quote}`
}
