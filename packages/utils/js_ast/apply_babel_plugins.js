/*
 * Useful when writin a babel plugin:
 * - https://astexplorer.net/
 * - https://bvaughn.github.io/babel-repl
 */
import {
  fileSystemPathToUrl,
  isFileSystemPath,
  urlToExtension,
  urlToFileSystemPath,
} from "@jsenv/urls"

import { createJsParseError } from "./js_parse_error.js"

export const applyBabelPlugins = async ({
  babelPlugins,
  urlInfo,
  ast,
  options = {},
}) => {
  const sourceType = {
    js_module: "module",
    js_classic: "classic",
    [urlInfo.type]: undefined,
  }[urlInfo.type]
  const url = urlInfo.originalUrl
  const generatedUrl = urlInfo.generatedUrl
  const content = urlInfo.content

  if (babelPlugins.length === 0) {
    return { code: content }
  }
  const { transformAsync, transformFromAstAsync } = await import("@babel/core")
  const sourceFileName = url.startsWith("file:")
    ? urlToFileSystemPath(url)
    : undefined
  options = {
    ast: false,
    // https://babeljs.io/docs/en/options#source-map-options
    sourceMaps: true,
    sourceFileName,
    filename: generatedUrl
      ? generatedUrl.startsWith("file:")
        ? urlToFileSystemPath(url)
        : undefined
      : sourceFileName,
    configFile: false,
    babelrc: false,
    highlightCode: false,
    // consider using startColumn and startLine for inline scripts?
    // see https://github.com/babel/babel/blob/3ee9db7afe741f4d2f7933c519d8e7672fccb08d/packages/babel-parser/src/options.js#L36-L39
    parserOpts: {
      sourceType,
      // allowAwaitOutsideFunction: true,
      plugins: [
        // "importMeta",
        // "topLevelAwait",
        "dynamicImport",
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
      return normalizeBabelReturnValue(result)
    }
    const result = await transformAsync(content, options)
    return normalizeBabelReturnValue(result)
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      throw createJsParseError({
        message: error.message,
        reasonCode: error.reasonCode,
        content,
        url,
        line: error.loc.line,
        column: error.loc.column,
      })
    }
    throw error
  }
}

const normalizeBabelReturnValue = (babelReturnValue) => {
  const { map } = babelReturnValue
  if (map) {
    map.sources.forEach((source, index) => {
      if (isFileSystemPath(source)) {
        map.sources[index] = fileSystemPathToUrl(source)
      }
    })
  }
  return babelReturnValue
}

// const pattern = [
//   "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
//   "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
// ].join("|")
// const ansiRegex = new RegExp(pattern, "g")
