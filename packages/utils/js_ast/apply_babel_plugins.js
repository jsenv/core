/*
 * Useful when writin a babel plugin:
 * - https://astexplorer.net/
 * - https://bvaughn.github.io/babel-repl
 */
import { urlToExtension, urlToFileSystemPath } from "@jsenv/filesystem"

export const applyBabelPlugins = async ({
  babelPlugins,
  url,
  generatedUrl,
  type = "js_module",
  ast,
  content,
  options = {},
}) => {
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
      sourceType: type === "js_module" ? "module" : "script",
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
      return result
    }
    const result = await transformAsync(content, options)
    return result
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      throw createParseError({
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

const createParseError = ({ message, reasonCode, url, line, column }) => {
  const parseError = new Error(message)
  parseError.reasonCode = reasonCode
  parseError.code = "PARSE_ERROR"
  parseError.url = url
  parseError.line = line
  parseError.column = column
  return parseError
}

// const pattern = [
//   "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
//   "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
// ].join("|")
// const ansiRegex = new RegExp(pattern, "g")
