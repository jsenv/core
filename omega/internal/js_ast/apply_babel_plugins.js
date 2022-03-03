import { urlToExtension, urlToFileSystemPath } from "@jsenv/filesystem"

import { stringifyUrlSite } from "#omega/internal/url_trace.js"

import { ansiToHTML } from "./ansi_to_html.js"
import { createParseError } from "./babel_parse_error.js"

export const applyBabelPlugins = async ({
  sourceFileFetcher,
  babelPlugins,
  url,
  ast,
  content,
  options,
}) => {
  if (babelPlugins.length === 0) {
    return { code: content }
  }
  const { transformAsync, transformFromAstAsync } = await import("@babel/core")
  const filepath = urlToFileSystemPath(url)
  options = {
    ast: false,
    sourceMaps: true,
    sourceFileName: filepath,
    filename: filepath,
    configFile: false,
    babelrc: false,
    parserOpts: {
      // sourceType: 'module',
      // allowAwaitOutsideFunction: true,
      plugins: [
        // "importMeta",
        // "topLevelAwait",
        "importAssertions",
        "jsx",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        ...([".ts", ".tsx"].includes(urlToExtension(url))
          ? ["typescript"]
          : []),
        ...(options.parserPlugins || []),
      ].filter(Boolean),
    },
    generatorOpts: {
      compact: false,
    },
    plugins: babelPlugins,
    ...options,
  }
  try {
    if (ast) {
      const result = await transformFromAstAsync(ast, content, options)
      return result
    }
    return await transformAsync(content, options)
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      let message = error.message
      let line = error.loc.line
      let column = error.loc.column
      const inlineUrlSite = sourceFileFetcher
        ? sourceFileFetcher.getInlineUrlSite(url)
        : null
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
