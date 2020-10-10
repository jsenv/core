// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/css-syntax-error.js#L43
// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/terminal-highlight.js#L50

import { grey, red, ansiResetSequence } from "../../executing/ansi.js"

export const extractSourceLocation = (
  url,
  source,
  location,
  { surroundingLinesAmount = 2, color = false } = {},
) => {
  const {
    line,
    column,
    // endColumn
  } = location

  let mark = (string) => string
  let aside = (string) => string
  if (color) {
    mark = (string) => `${red}${string}${ansiResetSequence}`
    aside = (string) => `${grey}${string}${ansiResetSequence}`
  }

  let lineRange = { start: line - 1, end: line }
  lineRange = moveLineRangeUp(lineRange, surroundingLinesAmount)
  lineRange = moveLineRangeDown(lineRange, surroundingLinesAmount)

  const lines = source.split(/\r?\n/)
  const linesToShow = applyLineRangeToLines(lineRange, lines)
  const endLineNumber = lineRange.end + 1
  const lineNumberMaxWidth = String(endLineNumber).length

  const sourceLocationAsString = linesToShow.map((line, index) => {
    const lineNumber = lineRange.start + index + 1
    const isMainLine = lineNumber === line
    const lineNumberWidth = String(lineNumber).length
    // ensure if line moves from 7,8,9 to 10 the display is still great
    const lineNumberRightSpacing = " ".repeat(lineNumberMaxWidth - lineNumberWidth)
    const lineSource = `${aside(`${lineNumber}${lineNumberRightSpacing} |`)} ${lineSource}`
    if (isMainLine) {
      const spacing = line.slice(0, column - 1).replace(/[^\t]/g, " ")
      return `${mark(">")} ${lineSource}
${spacing}${mark("^")}`
    }
    return `  ${lineSource}`
  })

  return `${url}:${line}:${column}:

${sourceLocationAsString}
`
}

// const getLineRangeLength = ({ start, end }) => end - start

const moveLineRangeUp = ({ start, end }, number) => {
  return {
    start: start - number,
    end,
  }
}

const moveLineRangeDown = ({ start, end }, number) => {
  return {
    start,
    end: end + number,
  }
}

const applyLineRangeToLines = ({ start, end }, lines) => {
  return lines.slice(start < 0 ? 0 : start, end > lines.length ? lines.length : end)
}
