// https://github.com/benjamingr/RegExp.escape/blob/master/polyfill.js

export const escapeRegexpSpecialCharacters = (string) => {
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

const isRegExpSpecialChar = (char) => regexpSpecialChars.indexOf(char) > -1

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
