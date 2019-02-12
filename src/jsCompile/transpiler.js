import path from "path"
import { transformAsync, transformFromAstAsync } from "@babel/core"
import syntaxDynamicImport from "@babel/plugin-syntax-dynamic-import"
import syntaxImportMeta from "@babel/plugin-syntax-import-meta"
import { arrayWithoutValue } from "@dmail/helper"
import transformModulesSystemJs from "../babel-plugin-transform-modules-systemjs/index.js"
import { regexpEscape } from "../stringHelper.js"

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

export const transpiler = async ({
  input,
  filename,
  filenameRelative,
  inputAst,
  inputMap,
  pluginMap,
  remap,
}) => {
  const transformModuleIntoSystemFormat = true
  const allowTopLevelAwait = true

  let asyncPluginName
  if ("transform-async-to-promises" in pluginMap) {
    asyncPluginName = "transform-async-to-promises"
  } else if ("transform-async-to-generator" in pluginMap) {
    asyncPluginName = "transform-async-to-generator"
  } else {
    asyncPluginName = ""
  }

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

  if (transformModuleIntoSystemFormat && allowTopLevelAwait && asyncPluginName) {
    const pluginNames = arrayWithoutValue(Object.keys(pluginMap), asyncPluginName)
    const result = await transpile({
      ast: inputAst,
      code: input,
      options: {
        ...options,
        plugins: [
          syntaxImportMeta,
          syntaxDynamicImport,
          ...pluginNames.map((pluginName) => pluginMap[pluginName]),
          transformModulesSystemJs,
        ],
      },
    })
    // required to transpile top level await and systemjs async execute
    return await transpile({
      ast: result.ast,
      code: result.code,
      options: {
        ...options,
        inputSourceMap: result.map,
        plugins: [syntaxImportMeta, syntaxDynamicImport, pluginMap[asyncPluginName]],
      },
    })
  }

  const pluginNames = Object.keys(pluginMap)
  return transpile({
    ast: inputAst,
    code: input,
    options: {
      ...options,
      plugins: [
        syntaxImportMeta,
        syntaxDynamicImport,
        ...pluginNames.map((pluginName) => pluginMap[pluginName]),
        transformModulesSystemJs,
      ],
    },
  })
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
