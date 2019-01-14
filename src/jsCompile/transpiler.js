import { transformAsync, transformFromAstAsync } from "@babel/core"
import { regexpEscape } from "../stringHelper.js"
import path from "path"

const transpile = ({ ast, code, options }) => {
  if (ast) {
    return transformFromAstAsync(ast, code, options)
  }
  return transformAsync(code, options)
}

export const transpiler = async ({
  file,
  fileAbsolute,
  inputAst,
  input,
  inputMap,
  plugins,
  remap,
}) => {
  // https://babeljs.io/docs/en/options
  const options = {
    plugins,
    filename: fileAbsolute || file,
    filenameRelative: file,
    inputSourceMap: inputMap,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: remap,
    sourceFileName: file,
  }

  try {
    const result = await transpile({ ast: inputAst, code: input, options })
    // result.map.sources = []
    return result
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      throw babelParseErrorToParseError(error, { options })
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
