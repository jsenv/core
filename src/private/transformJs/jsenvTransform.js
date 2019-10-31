import transformModulesSystemJs from "./babel-plugin-transform-modules-systemjs/index.js"
import { findAsyncPluginNameInBabelPluginMap } from "../findAsyncPluginNameInBabelPluginMap.js"
import { ansiToHTML } from "./ansiToHTML.js"
import { ensureRegeneratorRuntimeImportBabelPlugin } from "./ensureRegeneratorRuntimeImportBabelPlugin.js"
import { ensureGlobalThisImportBabelPlugin } from "./ensureGlobalThisImportBabelPlugin.js"
import {
  transformBabelHelperToImportBabelPlugin,
  searchPossibleBabelHelperNameInFilePath,
} from "./transformBabelHelperToImportBabelPlugin.js"

const { transformAsync, transformFromAstAsync } = import.meta.require("@babel/core")
const syntaxDynamicImport = import.meta.require("@babel/plugin-syntax-dynamic-import")
const syntaxImportMeta = import.meta.require("@babel/plugin-syntax-import-meta")

const defaultBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta]

export const jsenvTransform = async ({
  inputCode,
  inputPath,
  inputRelativePath,
  inputAst,
  inputMap,
  babelPluginMap,
  allowTopLevelAwait,
  transformTopLevelAwait,
  transformModuleIntoSystemFormat,
  transformGenerator,
  regeneratorRuntimeImportPath,
  remap,
}) => {
  // https://babeljs.io/docs/en/options
  const options = {
    filename: inputPath,
    filenameRelative: inputRelativePath,
    inputSourceMap: inputMap,
    configFile: false,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: remap,
    sourceFileName: inputPath,
    // https://babeljs.io/docs/en/options#parseropts
    parserOpts: {
      allowAwaitOutsideFunction: allowTopLevelAwait,
    },
  }

  const babelHelperName = searchPossibleBabelHelperNameInFilePath(inputPath)
  // to prevent typeof circular dependency
  if (babelHelperName === "typeof") {
    const babelPluginMapWithoutTransformTypeOf = {}
    Object.keys(babelPluginMap).forEach((key) => {
      if (key !== "transform-typeof-symbol") {
        babelPluginMapWithoutTransformTypeOf[key] = babelPluginMap[key]
      }
    })
    babelPluginMap = babelPluginMapWithoutTransformTypeOf
  }

  if (transformGenerator) {
    babelPluginMap = {
      ...babelPluginMap,
      "ensure-regenerator-runtime-import": [
        ensureRegeneratorRuntimeImportBabelPlugin,
        {
          regeneratorRuntimeImportPath,
        },
      ],
    }
  }

  babelPluginMap = {
    ...babelPluginMap,
    "ensure-global-this-import": [ensureGlobalThisImportBabelPlugin],
    "transform-babel-helpers-to-import": [transformBabelHelperToImportBabelPlugin],
  }

  const asyncPluginName = findAsyncPluginNameInBabelPluginMap(babelPluginMap)

  if (transformModuleIntoSystemFormat && transformTopLevelAwait && asyncPluginName) {
    const babelPluginArrayWithoutAsync = []
    Object.keys(babelPluginMap).forEach((name) => {
      if (name !== asyncPluginName) {
        babelPluginArrayWithoutAsync.push(babelPluginMap[name])
      }
    })

    // put body inside something like (async () => {})()
    const result = await babelTransform({
      ast: inputAst,
      code: inputCode,
      options: {
        ...options,
        plugins: [
          ...defaultBabelPluginArray,
          ...babelPluginArrayWithoutAsync,
          [transformModulesSystemJs, { topLevelAwait: transformTopLevelAwait }],
        ],
      },
    })

    // we need to retranspile the await keywords now wrapped
    // inside Systemjs function.
    // They are ignored, at least by transform-async-to-promises
    // see https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/26

    const finalResult = await babelTransform({
      // ast: result.ast,
      code: result.code,
      options: {
        ...options,
        // about inputSourceMap see
        // https://github.com/babel/babel/blob/eac4c5bc17133c2857f2c94c1a6a8643e3b547a7/packages/babel-core/src/transformation/file/generate.js#L57
        // https://github.com/babel/babel/blob/090c364a90fe73d36a30707fc612ce037bdbbb24/packages/babel-core/src/transformation/file/merge-map.js#L6s
        inputSourceMap: result.map,
        plugins: [...defaultBabelPluginArray, babelPluginMap[asyncPluginName]],
      },
    })

    return {
      ...result,
      ...finalResult,
      metadata: { ...result.metadata, ...finalResult.metadata },
    }
  }

  const babelPluginArray = [
    ...defaultBabelPluginArray,
    ...Object.keys(babelPluginMap).map((babelPluginName) => babelPluginMap[babelPluginName]),
    ...(transformModuleIntoSystemFormat
      ? [[transformModulesSystemJs, { topLevelAwait: transformTopLevelAwait }]]
      : []),
  ]
  const result = await babelTransform({
    ast: inputAst,
    code: inputCode,
    options: {
      ...options,
      plugins: babelPluginArray,
    },
  })
  return result
}

const babelTransform = async ({ ast, code, options }) => {
  try {
    if (ast) {
      const result = await transformFromAstAsync(ast, code, options)
      return result
    }
    return await transformAsync(code, options)
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      const message = error.message
      throw createParseError({
        message,
        messageHTML: ansiToHTML(message),
        filename: options.filename,
        lineNumber: error.loc.line,
        columnNumber: error.loc.column,
      })
    }
    throw error
  }
}

const createParseError = (data) => {
  const { message } = data
  const parseError = new Error(message)
  parseError.code = "PARSE_ERROR"
  parseError.data = data

  return parseError
}
