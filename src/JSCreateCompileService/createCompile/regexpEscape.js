// https://github.com/benjamingr/RegExp.escape/blob/master/polyfill.js
const regexpSpecialChars = [
  "/",
  "^",
  "\\",
  "[",
  "]",
  "(",
  ")",
  "{",
  "}",
  "?",
  "+",
  "*",
  ".",
  "|",
  "$",
]

const isRegExpSpecialChar = (char) => regexpSpecialChars.indexOf(char) > -1

export const regexpEscape = (string) => {
  string = String(string)
  let i = 0
  let escapedString = ""

  while (i < string.length) {
    const char = string[i]
    i++
    escapedString += isRegExpSpecialChar(char) ? `\\${char}` : char
  }
  return escapedString
}
