import { urlToRelativeUrl, urlToFileSystemPath } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"
import { createParseError } from "@jsenv/core/src/internal/compiling/babel_parse_error.js"
import { babelPluginTransformImportMeta } from "@jsenv/core/src/internal/compiling/babel_plugin_transform_import_meta.js"
import {
  getMinimalBabelPluginMap,
  babelPluginsFromBabelPluginMap,
} from "@jsenv/core/src/internal/compiling/babel_plugins.js"
import { babelPluginProxyExternalImports } from "@jsenv/core/src/internal/compiling/babel_plugin_proxy_external_imports.js"
import { babelPluginImportMetadata } from "@jsenv/core/src/internal/compiling/babel_plugin_import_metadata.js"

import { ansiToHTML } from "./ansiToHTML.js"
import { babelPluginRegeneratorRuntimeAsJsenvImport } from "./babel_plugin_regenerator_runtime_as_jsenv_import.js"
import { babelPluginBabelHelpersAsJsenvImports } from "./babel_plugin_babel_helpers_as_jsenv_imports.js"
import { babelPluginSystemJsPrepend } from "./babel_plugin_systemjs_prepend.js"
import { babelHelperNameFromUrl } from "./babelHelper.js"

export const transformJs = async ({
  projectDirectoryUrl,
  jsenvRemoteDirectory,
  url,

  babelPluginMap,
  moduleOutFormat = "esmodule",
  importMetaFormat = moduleOutFormat,
  babelHelpersInjectionAsImport = moduleOutFormat === "esmodule",
  prependSystemJs,
  topLevelAwait,
  transformGenerator = true,
  sourcemapEnabled = true,

  map,
  code,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(
      `projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`,
    )
  }
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(
      `babelPluginMap must be an object, got ${babelPluginMap}`,
    )
  }
  if (typeof code === "undefined") {
    throw new TypeError(`code missing, received ${code}`)
  }
  if (typeof url !== "string") {
    throw new TypeError(`url must be a string, got ${url}`)
  }
  if (babelHelpersInjectionAsImport && moduleOutFormat !== "esmodule") {
    throw new Error(
      `babelHelpersInjectionAsImport can be enabled only when "moduleOutFormat" is "esmodule"`,
    )
  }
  const relativeUrl = url.startsWith(projectDirectoryUrl)
    ? urlToRelativeUrl(url, projectDirectoryUrl)
    : undefined

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
      allowAwaitOutsideFunction:
        topLevelAwait === undefined ||
        topLevelAwait === "return" ||
        topLevelAwait === "simple" ||
        topLevelAwait === "ignore",
    },
    generatorOpts: {
      compact: false,
    },
  }
  const babelHelperName = babelHelperNameFromUrl(url)
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
      ],
    }
  }
  babelPluginMap = {
    ...getMinimalBabelPluginMap(),
    "transform-import-meta": [
      babelPluginTransformImportMeta,
      {
        importMetaFormat,
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
    ...(jsenvRemoteDirectory
      ? {
          "proxy-external-imports": [
            babelPluginProxyExternalImports,
            { jsenvRemoteDirectory },
          ],
        }
      : {}),
    "import-metadata": [babelPluginImportMetadata],
  }
  if (moduleOutFormat === "systemjs") {
    const transformModulesSystemJs = require("@babel/plugin-transform-modules-systemjs")
    const proposalDynamicImport = require("@babel/plugin-proposal-dynamic-import")
    babelPluginMap = {
      ...babelPluginMap,
      "proposal-dynamic-import": [proposalDynamicImport],
      "transform-modules-systemjs": [transformModulesSystemJs],
    }
  }
  if (prependSystemJs) {
    babelPluginMap = {
      ...babelPluginMap,
      "systemjs-prepend": [babelPluginSystemJsPrepend],
    }
  }

  const asyncToPromise = babelPluginMap["transform-async-to-promises"]
  if (topLevelAwait && asyncToPromise) {
    asyncToPromise.options.topLevelAwait = topLevelAwait
  }
  const babelTransformReturnValue = await babelTransform({
    ast,
    code,
    options: {
      ...options,
      plugins: babelPluginsFromBabelPluginMap(babelPluginMap),
    },
  })
  code = babelTransformReturnValue.code
  map = babelTransformReturnValue.map
  const ast = babelTransformReturnValue.ast
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
