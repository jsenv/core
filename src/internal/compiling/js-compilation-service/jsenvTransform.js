import { urlToFileSystemPath } from "@jsenv/filesystem"

import { require } from "@jsenv/core/src/internal/require.js"
import { babelPluginTransformImportMeta } from "@jsenv/core/src/internal/babel_plugin_transform_import_meta.js"
import {
  getMinimalBabelPluginMap,
  babelPluginsFromBabelPluginMap,
  extractSyntaxBabelPluginMap,
} from "@jsenv/core/src/internal/compiling/babel_plugins.js"
import { babelPluginImportMetadata } from "@jsenv/core/src/internal/compiling/babel_plugin_import_metadata.js"

import { findAsyncPluginNameInBabelPluginMap } from "./findAsyncPluginNameInBabelPluginMap.js"
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
  transformTopLevelAwait,
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

  const asyncPluginName = findAsyncPluginNameInBabelPluginMap(babelPluginMap)

  if (
    moduleOutFormat === "systemjs" &&
    transformTopLevelAwait &&
    asyncPluginName
  ) {
    const babelPluginMapWithoutAsync = {
      ...babelPluginMap,
      "proposal-dynamic-import": [proposalDynamicImport],
      "transform-modules-systemjs": [transformModulesSystemJs],
    }
    delete babelPluginMapWithoutAsync[asyncPluginName]

    // put body inside something like (async () => {})()
    const result = await babelTransform({
      ast,
      code,
      options: {
        ...options,
        plugins: babelPluginsFromBabelPluginMap(babelPluginMapWithoutAsync),
      },
    })

    // we need to retranspile the await keywords now wrapped
    // inside Systemjs function.
    // They are ignored, at least by transform-async-to-promises
    // see https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/26
    const { babelSyntaxPluginMap } = extractSyntaxBabelPluginMap(babelPluginMap)
    const finalResult = await babelTransform({
      // ast: result.ast,
      code: result.code,
      options: {
        ...options,
        // about inputSourceMap see
        // https://github.com/babel/babel/blob/eac4c5bc17133c2857f2c94c1a6a8643e3b547a7/packages/babel-core/src/transformation/file/generate.js#L57
        // https://github.com/babel/babel/blob/090c364a90fe73d36a30707fc612ce037bdbbb24/packages/babel-core/src/transformation/file/merge-map.js#L6s
        inputSourceMap: result.map,
        plugins: babelPluginsFromBabelPluginMap({
          ...babelSyntaxPluginMap,
          [asyncPluginName]: babelPluginMap[asyncPluginName],
        }),
      },
    })

    return {
      ...result,
      ...finalResult,
      metadata: { ...result.metadata, ...finalResult.metadata },
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
