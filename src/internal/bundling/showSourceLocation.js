// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/css-syntax-error.js#L43
// https://github.com/postcss/postcss/blob/fd30d3df5abc0954a0ec642a3cdc644ab2aacf9c/lib/terminal-highlight.js#L50
// https://github.com/babel/babel/blob/eea156b2cb8deecfcf82d52aa1b71ba4995c7d68/packages/babel-code-frame/src/index.js#L1

import { grey, red, ansiResetSequence } from "../executing/ansi.js"

export const showSourceLocation = (
  source,
  { line, column, numberOfSurroundingLinesToShow = 1, color = false },
) => {
  let mark = (string) => string
  let aside = (string) => string
  if (color) {
    mark = (string) => `${red}${string}${ansiResetSequence}`
    aside = (string) => `${grey}${string}${ansiResetSequence}`
  }

  const lines = source.split(/\r?\n/)
  let lineRange = {
    start: line - 1,
    end: line,
  }
  lineRange = moveLineRangeUp(lineRange, numberOfSurroundingLinesToShow)
  lineRange = moveLineRangeDown(lineRange, numberOfSurroundingLinesToShow)
  lineRange = lineRangeWithinLines(lineRange, lines)
  const linesToShow = lines.slice(lineRange.start, lineRange.end)
  const endLineNumber = lineRange.end
  const lineNumberMaxWidth = String(endLineNumber).length

  return linesToShow.map((lineSource, index) => {
    const lineNumber = lineRange.start + index + 1
    const isMainLine = lineNumber === line
    const lineNumberWidth = String(lineNumber).length
    // ensure if line moves from 7,8,9 to 10 the display is still great
    const lineNumberRightSpacing = " ".repeat(lineNumberMaxWidth - lineNumberWidth)
    const asideSource = `${lineNumber}${lineNumberRightSpacing} |`
    const lineFormatted = `${aside(asideSource)} ${lineSource}`
    if (isMainLine) {
      const spacing = stringToSpaces(`${asideSource} ${lineSource.slice(0, column - 1)}`)
      return `${mark(">")} ${lineFormatted}
  ${spacing}${mark("^")}`
    }
    return `  ${lineFormatted}`
  }).join(`
`)
}

const stringToSpaces = (string) => string.replace(/[^\t]/g, " ")

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

const lineRangeWithinLines = ({ start, end }, lines) => {
  return {
    start: start < 0 ? 0 : start,
    end: end > lines.length ? lines.length : end,
  }
}
