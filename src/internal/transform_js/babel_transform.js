import { urlToFileSystemPath } from "@jsenv/filesystem"
import { stringifyUrlSite } from "../building/url_trace.js"

import { ansiToHTML } from "./ansi_to_html.js"
import { createParseError } from "./babel_parse_error.js"

export const babelTransform = async ({
  sourceFileFetcher,
  options,
  url,
  ast,
  code,
}) => {
  const { transformAsync, transformFromAstAsync } = await import("@babel/core")

  try {
    if (ast) {
      const result = await transformFromAstAsync(ast, code, options)
      return result
    }
    return await transformAsync(code, options)
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      let message = error.message
      let line = error.loc.line
      let column = error.loc.column
      const inlineUrlSite = sourceFileFetcher.getInlineUrlSite(url)
      if (inlineUrlSite) {
        line = inlineUrlSite.line + line - 2 // remove 2 lines
        column = inlineUrlSite.column + column
        message = `${error.reasonCode}
${stringifyUrlSite({
  ...inlineUrlSite,
  line,
  column,
})}`
        throw createParseError({
          filename: urlToFileSystemPath(inlineUrlSite.url),
          line,
          column,
          message,
        })
      }
      const messageWithoutAnsi = message.replace(ansiRegex, "")
      throw createParseError({
        cause: error,
        filename: options.filename,
        line,
        column,
        message: messageWithoutAnsi,
        messageHTML: ansiToHTML(message),
      })
    }
    throw error
  }
}

const pattern = [
  "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
  "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
].join("|")
const ansiRegex = new RegExp(pattern, "g")
