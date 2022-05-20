import { Parser, getLineInfo } from "acorn"
import { importAssertions } from "acorn-import-assertions"

import { createJsParseError } from "./js_parse_error.js"

const AcornParser = Parser.extend(importAssertions)

export const parseJsWithAcorn = ({ js, url, isJsModule }) => {
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
      const { line, column } = getLineInfo(js, e.raisedAt)
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
