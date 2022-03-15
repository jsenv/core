import { urlToExtension, urlToFileSystemPath } from "@jsenv/filesystem"

export const applyBabelPlugins = async ({
  babelPlugins,
  url,
  type = "js_module",
  ast,
  content,
  options = {},
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
      sourceType: type === "js_module" ? "module" : "script",
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

const createParseError = ({ message, url, line, column }) => {
  const parseError = new Error(message)
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
