import { isEscaped } from "./is_escaped.js"

export const escapeStringSpecialChars = (
  string,
  { quote, allowEscapeForVersioning = false },
) => {
  const replacements = {
    [quote]: `\\${quote}`,
    "\n": "\\n",
    "\r": "\\r",
    "\u2028": "\\u2028",
    "\u2029": "\\u2029",
  }

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
  return result
}
