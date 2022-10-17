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

export const preNewLineAndIndentation = (
  value,
  { depth, indentUsingTab, indentSize },
) => {
  return `${newLineAndIndent({
    count: depth + 1,
    useTabs: indentUsingTab,
    size: indentSize,
  })}${value}`
}

const postNewLineAndIndentation = ({ depth, indentUsingTab, indentSize }) => {
  return newLineAndIndent({
    count: depth,
    useTabs: indentUsingTab,
    size: indentSize,
  })
}

const newLineAndIndent = ({ count, useTabs, size }) => {
  if (useTabs) {
    // eslint-disable-next-line prefer-template
    return "\n" + "\t".repeat(count)
  }
  // eslint-disable-next-line prefer-template
  return "\n" + " ".repeat(count * size)
}

export const wrapNewLineAndIndentation = (
  value,
  { depth, indentUsingTab, indentSize },
) => {
  return `${preNewLineAndIndentation(value, {
    depth,
    indentUsingTab,
    indentSize,
  })}${postNewLineAndIndentation({ depth, indentUsingTab, indentSize })}`
}
