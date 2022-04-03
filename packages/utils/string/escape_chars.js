import { isEscaped } from "./is_escaped.js"

export const escapeChars = (string, replacements) => {
  const charsToEscape = Object.keys(replacements)
  let result = ""
  let last = 0
  let i = 0
  while (i < string.length) {
    const char = string[i]
    i++
    if (charsToEscape.includes(char) && !isEscaped(i - 1, string)) {
      if (last === i - 1) {
        result += replacements[char]
      } else {
        result += `${string.slice(last, i - 1)}${replacements[char]}`
      }
      last = i
    }
  }
  if (last !== string.length) {
    result += string.slice(last)
  }
  return result
}
