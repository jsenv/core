import { isEscaped } from "./is_escaped.js"

export const JS_QUOTES = {
  pickBest: (string, { canUseTemplateString, defaultQuote = DOUBLE } = {}) => {
    // check default first, once tested do no re-test it
    if (!string.includes(defaultQuote)) {
      return defaultQuote
    }
    if (defaultQuote !== DOUBLE && !string.includes(DOUBLE)) {
      return DOUBLE
    }
    if (defaultQuote !== SINGLE && !string.includes(SINGLE)) {
      return SINGLE
    }
    if (
      canUseTemplateString &&
      defaultQuote !== BACKTICK &&
      !string.includes(BACKTICK)
    ) {
      return BACKTICK
    }
    return defaultQuote
  },

  escapeSpecialChars: (
    string,
    {
      quote = "pickBest",
      canUseTemplateString,
      defaultQuote,
      allowEscapeForVersioning = false,
    },
  ) => {
    quote =
      quote === "pickBest"
        ? JS_QUOTES.pickBest(string, { canUseTemplateString, defaultQuote })
        : quote
    const replacements = JS_QUOTE_REPLACEMENTS[quote]
    let result = ""
    let last = 0
    let i = 0
    while (i < string.length) {
      const char = string[i]
      i++
      if (isEscaped(i - 1, string)) continue
      const replacement = replacements[char]
      if (replacement) {
        if (
          allowEscapeForVersioning &&
          char === quote &&
          string.slice(i, i + 6) === "+__v__"
        ) {
          let isVersioningConcatenation = false
          let j = i + 6 // start after the +
          while (j < string.length) {
            const lookAheadChar = string[j]
            j++
            if (
              lookAheadChar === "+" &&
              string[j] === quote &&
              !isEscaped(j - 1, string)
            ) {
              isVersioningConcatenation = true
              break
            }
          }
          if (isVersioningConcatenation) {
            // it's a concatenation
            // skip until the end of concatenation (the second +)
            // and resume from there
            i = j + 1
            continue
          }
        }
        if (last === i - 1) {
          result += replacement
        } else {
          result += `${string.slice(last, i - 1)}${replacement}`
        }
        last = i
      }
    }
    if (last !== string.length) {
      result += string.slice(last)
    }
    return `${quote}${result}${quote}`
  },
}

const DOUBLE = `"`
const SINGLE = `'`
const BACKTICK = "`"
const lineEndingEscapes = {
  "\n": "\\n",
  "\r": "\\r",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
}
const JS_QUOTE_REPLACEMENTS = {
  [DOUBLE]: {
    '"': '\\"',
    ...lineEndingEscapes,
  },
  [SINGLE]: {
    "'": "\\'",
    ...lineEndingEscapes,
  },
  [BACKTICK]: {
    "`": "\\`",
    "$": "\\$",
  },
}
