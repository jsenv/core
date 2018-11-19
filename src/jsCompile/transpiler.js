import { transformAsync, transformFromAstAsync } from "@babel/core"
import { regexpEscape } from "../stringHelper.js"
import path from "path"

const transpile = ({ inputAst, inputSource, options }) => {
  if (inputAst) {
    return transformFromAstAsync(inputAst, inputSource, options)
  }
  return transformAsync(inputSource, options)
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

export const transpiler = async ({
  localRoot,
  file,
  inputAst,
  input,
  inputMap,
  plugins,
  remap,
}) => {
  const options = {
    plugins,
    filename: localRoot ? `${localRoot}/${file}` : file,
    filenameRelative: file,
    inputSourceMap: inputMap,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: remap,
  }

  try {
    return await transpile({ ast: inputAst, code: input, options })
  } catch (error) {
    if (error && error.code === "BABEL_PARSE_ERROR") {
      return Promise.reject({
        name: "PARSE_ERROR",
        message: transformBabelParseErrorMessage(
          error.message,
          options.filename,
          options.filenameRelative,
        ),
        fileName: options.filenameRelative,
        lineNumber: error.loc.line,
        columnNumber: error.loc.column,
        // stack: error.stack
      })
    }
    throw error
  }
}
