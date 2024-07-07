/*
 * Useful when writin a babel plugin:
 * - https://astexplorer.net/
 * - https://bvaughn.github.io/babel-repl
 */
import { fileURLToPath, pathToFileURL } from "node:url";

import { createJsParseError } from "./js_parse_error.js";

export const applyBabelPlugins = async ({
  babelPlugins,
  input,
  inputIsJsModule,
  inputUrl,
  outputUrl,
  ast,
  options = {},
}) => {
  if (babelPlugins.length === 0) {
    return { code: input };
  }
  const { transformAsync, transformFromAstAsync } = await import("@babel/core");
  const sourceFileName = inputUrl.startsWith("file:")
    ? fileURLToPath(inputUrl)
    : undefined;
  options = {
    ast: false,
    // https://babeljs.io/docs/en/options#source-map-options
    sourceMaps: true,
    sourceFileName,
    filename: outputUrl
      ? outputUrl.startsWith("file:")
        ? fileURLToPath(inputUrl)
        : undefined
      : sourceFileName,
    configFile: false,
    babelrc: false,
    highlightCode: false,
    // consider using startColumn and startLine for inline scripts?
    // see https://github.com/babel/babel/blob/3ee9db7afe741f4d2f7933c519d8e7672fccb08d/packages/babel-parser/src/options.js#L36-L39
    parserOpts: {
      sourceType: inputIsJsModule ? "module" : "classic",
      // allowAwaitOutsideFunction: true,
      plugins: [
        // "importMeta",
        // "topLevelAwait",
        ...(inputIsJsModule ? ["dynamicImport", "importAttributes"] : []),
        "jsx",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        ...(useTypeScriptExtension(inputUrl) ? ["typescript"] : []),
        ...(options.parserPlugins || []),
      ].filter(Boolean),
    },
    plugins: babelPlugins,
    ...options,
    generatorOpts: {
      compact: false,
      ...(options.generatorOpts || {}),
    },
  };
  try {
    if (ast) {
      const result = await transformFromAstAsync(ast, input, options);
      return normalizeResult(result);
    }
    const result = await transformAsync(input, options);
    return normalizeResult(result);
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      throw createJsParseError({
        message: error.message,
        reasonCode: error.reasonCode,
        content: input,
        url: inputUrl,
        line: error.loc.line,
        column: error.loc.column,
      });
    }
    throw error;
  }
};

const normalizeResult = (result) => {
  const { map } = result;
  if (map) {
    map.sources.forEach((source, index) => {
      map.sources[index] = pathToFileURL(source).href;
    });
  }
  return result;
};

const useTypeScriptExtension = (url) => {
  const { pathname } = new URL(url);
  return pathname.endsWith(".ts") || pathname.endsWith(".tsx");
};

// const pattern = [
//   "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
//   "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))",
// ].join("|")
// const ansiRegex = new RegExp(pattern, "g")
