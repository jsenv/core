import { fileRead } from "@dmail/helper"
import { namedValueDescriptionToMetaDescription, pathnameToMeta } from "@dmail/project-structure"
import transformModulesSystemJs from "../babel-plugin-transform-modules-systemjs/index.js"
import { ansiToHTML } from "../ansiToHTML.js"
import { createParseError } from "../compiled-file-service/index.js"

const { transformAsync, transformFromAstAsync } = import.meta.require("@babel/core")
const syntaxDynamicImport = import.meta.require("@babel/plugin-syntax-dynamic-import")
const syntaxImportMeta = import.meta.require("@babel/plugin-syntax-import-meta")

const defaultBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta]

export const transformFile = async ({
  filename,
  filenameRelative,
  babelPluginMap,
  convertMap = {},
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  remap = true,
}) => {
  let originalCode
  let inputCode
  let inputMap

  const metaDescription = namedValueDescriptionToMetaDescription({
    convert: convertMap,
  })
  const { convert } = pathnameToMeta({ pathname: `/${filenameRelative}`, metaDescription })
  if (convert) {
    if (typeof convert !== "function") {
      throw new TypeError(`convert must be a function, got ${convert}`)
    }
    const conversionResult = await convert({
      filename,
      filenameRelative,
      remap,
      allowTopLevelAwait,
    })
    if (typeof conversionResult !== "object") {
      throw new TypeError(`convert must return an object, got ${conversionResult}`)
    }
    const code = conversionResult.code
    if (typeof code !== "string") {
      throw new TypeError(`convert must return { code } string, got { code: ${code} } `)
    }
    originalCode = conversionResult.originalCode
    inputCode = code
    inputMap = conversionResult.map
  } else {
    originalCode = await fileRead(filename)
    inputCode = originalCode
  }

  const transformResult = await jsenvTransform({
    inputCode,
    filename,
    filenameRelative,
    inputMap,
    babelPluginMap,
    convertMap,
    allowTopLevelAwait,
    transformTopLevelAwait,
    transformModuleIntoSystemFormat,
    remap,
  })
  return { originalCode, ...transformResult }
}

const jsenvTransform = async ({
  inputCode,
  filename,
  filenameRelative,
  inputAst,
  inputMap,
  babelPluginMap,
  allowTopLevelAwait,
  transformTopLevelAwait,
  transformModuleIntoSystemFormat,
  remap,
}) => {
  // https://babeljs.io/docs/en/options
  const options = {
    filename: filename || filenameRelative,
    filenameRelative,
    inputSourceMap: inputMap,
    configFile: false,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: remap,
    sourceFileName: filenameRelative,
    // https://babeljs.io/docs/en/options#parseropts
    parserOpts: {
      allowAwaitOutsideFunction: allowTopLevelAwait,
    },
  }

  const asyncPluginName = findAsyncPluginNameInbabelPluginMap(babelPluginMap)

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

export const findAsyncPluginNameInbabelPluginMap = (babelPluginMap) => {
  if ("transform-async-to-promises" in babelPluginMap) {
    return "transform-async-to-promises"
  }
  if ("transform-async-to-generator" in babelPluginMap) {
    return "transform-async-to-generator"
  }
  return ""
}

const babelTransform = async ({ ast, code, options }) => {
  try {
    if (ast) {
      return await transformFromAstAsync(ast, code, options)
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
