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

export const stringToArrayBuffer = (string) => {
  string = String(string)
  const buffer = new ArrayBuffer(string.length * 2) // 2 bytes for each char
  const bufferView = new Uint16Array(buffer)
  let i = 0
  while (i < string.length) {
    bufferView[i] = string.charCodeAt(i)
    i++
  }
  return buffer
}

// https://stackoverflow.com/questions/28643272/how-to-include-an-escapedscript-script-tag-in-a-javascript-variable/28643409#28643409
export const escapeClosingScriptTag = (string) => {
  return string.replace(/\<\/script\>/g, "<\\/script>")
}
