import { urlToFileSystemPath } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"
import { babelPluginTransformImportMeta } from "@jsenv/core/src/internal/babel_plugin_transform_import_meta.js"
import {
  getMinimalBabelPluginMap,
  babelPluginsFromBabelPluginMap,
} from "@jsenv/core/src/internal/compiling/babel_plugins.js"
import { babelPluginImportMetadata } from "@jsenv/core/src/internal/compiling/babel_plugin_import_metadata.js"

import { ansiToHTML } from "./ansiToHTML.js"
import { babelPluginRegeneratorRuntimeAsJsenvImport } from "./babel_plugin_regenerator_runtime_as_jsenv_import.js"
import { babelPluginBabelHelpersAsJsenvImports } from "./babel_plugin_babel_helpers_as_jsenv_imports.js"
import { filePathToBabelHelperName } from "./babelHelper.js"

export const jsenvTransform = async ({
  code,
  map, // optional
  ast, // optional
  url,
  relativeUrl, // optional

  babelPluginMap,
  moduleOutFormat,
  importMetaFormat = moduleOutFormat,

  babelHelpersInjectionAsImport,
  allowTopLevelAwait,
  transformGenerator,
  regeneratorRuntimeImportPath,
  sourcemapEnabled,
}) => {
  const transformModulesSystemJs = require("@babel/plugin-transform-modules-systemjs")
  const proposalDynamicImport = require("@babel/plugin-proposal-dynamic-import")

  const inputPath = computeInputPath(url)

  // https://babeljs.io/docs/en/options
  const options = {
    filename: inputPath,
    filenameRelative: relativeUrl,
    inputSourceMap: map,
    configFile: false,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: sourcemapEnabled,
    sourceFileName: inputPath,
    // https://babeljs.io/docs/en/options#parseropts
    parserOpts: {
      allowAwaitOutsideFunction: allowTopLevelAwait,
    },
    generatorOpts: {
      compact: false,
    },
  }

  const babelHelperName = filePathToBabelHelperName(inputPath)
  // to prevent typeof circular dependency
  if (babelHelperName === "typeof") {
    const babelPluginMapWithoutTransformTypeOf = { ...babelPluginMap }
    delete babelPluginMapWithoutTransformTypeOf["transform-typeof-symbol"]
    babelPluginMap = babelPluginMapWithoutTransformTypeOf
  }

  if (transformGenerator) {
    babelPluginMap = {
      ...babelPluginMap,
      "regenerator-runtime-as-jsenv-import": [
        babelPluginRegeneratorRuntimeAsJsenvImport,
        {
          regeneratorRuntimeImportPath,
        },
      ],
    }
  }

  babelPluginMap = {
    ...getMinimalBabelPluginMap(),
    "transform-import-meta": [
      babelPluginTransformImportMeta,
      {
        replaceImportMeta: (
          metaPropertyName,
          { replaceWithImport, replaceWithValue },
        ) => {
          if (metaPropertyName === "url") {
            if (importMetaFormat === "esmodule") {
              // keep native version
              return
            }
            if (importMetaFormat === "systemjs") {
              // systemjs will handle it
              return
            }
            if (importMetaFormat === "commonjs") {
              replaceWithImport({
                from: `@jsenv/core/helpers/import-meta/import-meta-url-commonjs.js`,
              })
              return
            }
            if (importMetaFormat === "global") {
              replaceWithImport({
                from: `@jsenv/core/helpers/import-meta/import-meta-url-global.js`,
              })
              return
            }
            return
          }

          if (metaPropertyName === "resolve") {
            if (importMetaFormat === "esmodule") {
              // keep native version
              return
            }
            if (importMetaFormat === "systemjs") {
              // systemjs will handle it
              return
            }
            if (importMetaFormat === "commonjs") {
              throw createParseError({
                message: `import.meta.resolve() not supported with commonjs format`,
              })
            }
            if (importMetaFormat === "global") {
              throw createParseError({
                message: `import.meta.resolve() not supported with global format`,
              })
            }
            return
          }

          replaceWithValue(undefined)
        },
      },
    ],
    ...babelPluginMap,
    ...(babelHelpersInjectionAsImport
      ? {
          "babel-helpers-as-jsenv-imports": [
            babelPluginBabelHelpersAsJsenvImports,
          ],
        }
      : {}),
    "import-metadata": [babelPluginImportMetadata],
  }

  if (allowTopLevelAwait) {
    const asyncToPromise = babelPluginMap["transform-async-to-promises"]
    if (asyncToPromise) {
      asyncToPromise.options.topLevelAwait =
        moduleOutFormat === "systemjs" ? "return" : "simple"
    }
  }

  const babelTransformReturnValue = await babelTransform({
    ast,
    code,
    options: {
      ...options,
      plugins: babelPluginsFromBabelPluginMap({
        ...babelPluginMap,
        ...(moduleOutFormat === "systemjs"
          ? {
              "proposal-dynamic-import": [proposalDynamicImport],
              ...(moduleOutFormat === "systemjs"
                ? { "transform-modules-systemjs": [transformModulesSystemJs] }
                : {}),
            }
          : {}),
      }),
    },
  })
  code = babelTransformReturnValue.code
  map = babelTransformReturnValue.map
  ast = babelTransformReturnValue.ast
  const { metadata } = babelTransformReturnValue
  return { code, map, metadata, ast }
}

const computeInputPath = (url) => {
  if (url.startsWith("file://")) {
    return urlToFileSystemPath(url)
  }
  return url
}

const babelTransform = async ({ ast, code, options }) => {
  const { transformAsync, transformFromAstAsync } = await import("@babel/core")

  try {
    if (ast) {
      const result = await transformFromAstAsync(ast, code, options)
      return result
    }
    return await transformAsync(code, options)
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      const message = error.message
      const messageWithoutAnsi = message.replace(ansiRegex, "")
      throw createParseError({
        cause: error,
        message: messageWithoutAnsi,
        messageHTML: ansiToHTML(message),
        filename: options.filename,
        lineNumber: error.loc.line,
        columnNumber: error.loc.column,
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

const createParseError = ({ message, cause, ...data }) => {
  const parseError = new Error(message, { cause })
  parseError.code = "PARSE_ERROR"
  parseError.data = {
    message,
    ...data,
  }

  return parseError
}
