// https://github.com/mgenware/string-to-template-literal/blob/main/src/main.ts#L1

export const escapeTemplateStringSpecialCharacters = (string) => {
  string = String(string)
  let i = 0
  let escapedString = ""

  while (i < string.length) {
    const char = string[i]
    i++
    escapedString += isTemplateStringSpecialChar(char) ? `\\${char}` : char
  }

  return escapedString
}

const isTemplateStringSpecialChar = (char) =>
  templateStringSpecialChars.indexOf(char) > -1

const templateStringSpecialChars = ["\\", "`", "$"]
