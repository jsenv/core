import { createJsParseError } from "./js_parse_error.js"

let AcornParser
let _getLineInfo

export const parseJsWithAcorn = async ({ js, url, isJsModule }) => {
  await initAcornParser()
  try {
    // https://github.com/acornjs/acorn/tree/master/acorn#interface
    const jsAst = AcornParser.parse(js, {
      locations: true,
      allowAwaitOutsideFunction: true,
      sourceType: isJsModule ? "module" : "script",
      ecmaVersion: 2022,
    })
    return jsAst
  } catch (e) {
    if (e && e.name === "SyntaxError") {
      const { line, column } = _getLineInfo(js, e.raisedAt)
      throw createJsParseError({
        message: e.message,
        url,
        line,
        column,
      })
    }
    throw e
  }
}

const initAcornParser = async () => {
  if (AcornParser) {
    return
  }
  const { Parser, getLineInfo } = await import("acorn")
  const { importAssertions } = await import("acorn-import-assertions")

  AcornParser = Parser.extend(importAssertions)
  _getLineInfo = getLineInfo
}
