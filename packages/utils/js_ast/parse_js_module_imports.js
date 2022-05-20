import { init, parse } from "es-module-lexer"

import { createJsParseError } from "./js_parse_error.js"

// see https://github.com/guybedford/es-module-lexer#usage
export const parseJsModuleImports = async ({ js, url }) => {
  // 99% of js modules uses import/export. For thoose who don't we can afford to parse for nothing
  // instead of checking for nothing 99% of the time
  // if (!js.includes("import") && !js.includes("export")) {
  //   return [[], []]
  // }
  await init
  let parseReturnValue
  try {
    parseReturnValue = parse(js, url)
  } catch (e) {
    if (e && e.idx === 0) {
      throw createJsParseError({
        message: e,
        url,
        line: e.message.split(":")[1],
        column: e.message.split(":")[2],
      })
    }
    throw e
  }
  const [imports, exports] = parseReturnValue
  const literalImports = imports.filter((importInfo) => Boolean(importInfo.n)) // filter out dynamic import that are not String literals
  if (literalImports.length === 0) {
    return [literalImports, exports]
  }
  const findLineAndColumn = createLineAndColumnFinder(js)
  const literalImportsClean = literalImports.map((importInfo) => {
    const isDynamic = importInfo.d > -1
    const usesAssert = importInfo.a > -1
    const specifierStart = isDynamic ? importInfo.s : importInfo.s - 1
    const specifierEnd = isDynamic ? importInfo.e : importInfo.e + 1
    const { line, column } = findLineAndColumn(specifierStart)

    let expectedType = "js_module"
    if (usesAssert) {
      const assertString = js.slice(importInfo.a, importInfo.se - 1)
      if (assertString.includes("json")) {
        expectedType = "json"
      } else if (assertString.includes("css")) {
        expectedType = "css"
      } else if (assertString.includes("text")) {
        expectedType = "text"
      }
    }

    return {
      subtype: isDynamic ? "import_dynamic" : "import_static",
      specifier: importInfo.n,
      specifierStart,
      specifierEnd,
      specifierLine: line,
      specifierColumn: column,
      usesAssert,
      expectedType,
    }
  })
  return [literalImportsClean, exports]
}

const createLineAndColumnFinder = (string) => {
  const lineSep = string.indexOf("\n\r") > -1 ? "\n\r" : "\n"
  const lines = string.split(lineSep)
  const lineStartIndexes = []
  let index = 0
  lines.forEach((line) => {
    lineStartIndexes.push(index)
    index += line.length + lineSep.length
  })
  return (index) => {
    const lineIndex = lineIndexFromIndex(index, lineStartIndexes)
    const lineStartIndex = lineStartIndexes[lineIndex]
    const columnIndex = index - lineStartIndex
    return {
      line: lineIndex + 1,
      column: columnIndex + 1,
    }
  }
}

const lineIndexFromIndex = (index, lineStartIndexes) => {
  const lastLineIndex = lineStartIndexes.length - 1
  const lastLineStartIndex = lineStartIndexes[lastLineIndex]
  if (index > lastLineStartIndex) {
    return lastLineIndex
  }
  let i = 0
  while (i < lineStartIndexes.length) {
    const lineStartIndex = lineStartIndexes[i]
    i++
    if (index > lineStartIndex && index < lineStartIndexes[i]) {
      return i - 1
    }
  }
  return -1
}
