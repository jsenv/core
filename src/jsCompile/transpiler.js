import path from "path"
import { regexpEscape } from "../stringHelper.js"

const { transformAsync, transformFromAstAsync } = import.meta.require("@babel/core")
const syntaxDynamicImport = import.meta.require("@babel/plugin-syntax-dynamic-import")
const syntaxImportMeta = import.meta.require("@babel/plugin-syntax-import-meta")
const transformModulesSystemJs = import.meta.require(
  "../babel-plugin-transform-modules-systemjs/index.js",
)

const defaultBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta]

export const transpiler = async ({
  input,
  filename,
  filenameRelative,
  inputAst,
  inputMap,
  babelConfigMap,
  allowTopLevelAwait = true,
  transformTopLevelAwait = true,
  transformModuleIntoSystemFormat = true,
  remap = true,
}) => {
  // https://babeljs.io/docs/en/options
  const options = {
    filename: filename || filenameRelative,
    filenameRelative,
    inputSourceMap: inputMap,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: remap,
    sourceFileName: filenameRelative,
    // https://babeljs.io/docs/en/options#parseropts
    parserOpts: {
      allowAwaitOutsideFunction: allowTopLevelAwait,
    },
  }

  const asyncPluginName = findAsyncPluginNameInBabelConfigMap(babelConfigMap)

  if (transformModuleIntoSystemFormat && transformTopLevelAwait && asyncPluginName) {
    const babelConfigMapWithoutAsyncPlugin = {}
    Object.keys(babelConfigMap).forEach((name) => {
      if (name !== asyncPluginName) babelConfigMapWithoutAsyncPlugin[name] = babelConfigMap[name]
    })

    // put body inside something like (async () => {})()
    const result = await transpile({
      ast: inputAst,
      code: input,
      options: {
        ...options,
        plugins: [
          ...defaultBabelPluginArray,
          ...Object.keys(babelConfigMapWithoutAsyncPlugin).map(
            (babelPluginName) => babelConfigMapWithoutAsyncPlugin[babelPluginName],
          ),
          [transformModulesSystemJs, { topLevelAwait: transformTopLevelAwait }],
        ],
      },
    })

    // we need to retranspile the await keywords now wrapped
    // inside Systemjs function.
    // They are ignored, at least by transform-async-to-promises
    // see https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/26

    const finalResult = await transpile({
      // ast: result.ast,
      code: result.code,
      options: {
        ...options,
        // about inputSourceMap see
        // https://github.com/babel/babel/blob/eac4c5bc17133c2857f2c94c1a6a8643e3b547a7/packages/babel-core/src/transformation/file/generate.js#L57
        // https://github.com/babel/babel/blob/090c364a90fe73d36a30707fc612ce037bdbbb24/packages/babel-core/src/transformation/file/merge-map.js#L6s
        inputSourceMap: result.map,
        plugins: [...defaultBabelPluginArray, babelConfigMap[asyncPluginName]],
      },
    })

    return finalResult
  }

  const babelPluginArray = [
    ...defaultBabelPluginArray,
    ...Object.keys(babelConfigMap).map((babelPluginName) => babelConfigMap[babelPluginName]),
    ...(transformModuleIntoSystemFormat
      ? [[transformModulesSystemJs, { topLevelAwait: transformTopLevelAwait }]]
      : []),
  ]
  return transpile({
    ast: inputAst,
    code: input,
    options: {
      ...options,
      plugins: babelPluginArray,
    },
  })
}

export const findAsyncPluginNameInBabelConfigMap = (babelConfigMap) => {
  if ("transform-async-to-promises" in babelConfigMap) {
    return "transform-async-to-promises"
  }
  if ("transform-async-to-generator" in babelConfigMap) {
    return "transform-async-to-generator"
  }
  return ""
}

const transpile = async ({ ast, code, options }) => {
  try {
    if (ast) {
      return await transformFromAstAsync(ast, code, options)
    }
    return await transformAsync(code, options)
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      throw babelParseErrorToParseError(error, options)
    }
    throw error
  }
}

const babelParseErrorToParseError = (babelParseError, { filename, filenameRelative }) => {
  const parseError = new Error()

  parseError.name = "PARSE_ERROR"
  parseError.message = transformBabelParseErrorMessage(
    babelParseError.message,
    filename,
    filenameRelative,
  )
  parseError.fileName = filenameRelative
  parseError.lineNumber = babelParseError.loc.line
  parseError.columnNumber = babelParseError.loc.column
  // parseError.stack = error.stack
  return parseError
}

const transformBabelParseErrorMessage = (babelParseErrorMessage, filename, relativeName) => {
  // the babelParseErrorMessage looks somehow like that:
  /*
  `${absoluteFilename}: Unexpected token(${lineNumber}:${columnNumber}})

    ${lineNumber - 1} | ${sourceForThatLine}
  > ${lineNumber} | ${sourceForThatLine}
    | ^`
  */
  // and the idea is to replace absoluteFilename by something relative

  const filenameAbsolute = path.sep === "/" ? filename : filename.replace(/\//g, "\\")
  const filenameAbsoluteRegexp = new RegExp(regexpEscape(filenameAbsolute), "gi")
  const filenameRelative = `${relativeName}`.replace(/\\/g, "/")
  const parseErrorMessage = babelParseErrorMessage.replace(filenameAbsoluteRegexp, filenameRelative)
  return parseErrorMessage
}
