import { transformAsync, transformFromAstAsync } from "@babel/core"
import { regexpEscape } from "./regexpEscape.js"
import path from "path"

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")

const transpile = ({ inputAst, inputSource, options }) => {
  if (inputAst) {
    return transformFromAstAsync(inputAst, inputSource, options)
  }
  return transformAsync(inputSource, options)
}

const transformBabelParseErrorMessage = (babelParseErrorMessage, root, relativeName) => {
  // the babelParseErrorMessage looks somehow like that:
  /*
  `${absoluteFilename}: Unexpected token(${lineNumber}:${columnNumber}})

    ${lineNumber - 1} | ${sourceForThatLine}
  > ${lineNumber} | ${sourceForThatLine}
    | ^`
  */
  // and the idea is to replace absoluteFilename by something relative

  const filenameAbsolute = `${root}${path.sep}${relativeName.replace(/\//g, path.sep)}`
  const filenameAbsoluteRegexp = new RegExp(regexpEscape(filenameAbsolute), "gi")
  const filenameRelative = `${relativeName}`.replace(/\\/g, "/")
  const parseErrorMessage = babelParseErrorMessage.replace(filenameAbsoluteRegexp, filenameRelative)
  return parseErrorMessage
}

export const transpileWithBabel = ({
  root,
  inputAst,
  inputSource,
  options,
  outputSourceMapName,
  sourceLocationForSourceMap,
  sourceNameForSourceMap,
}) => {
  const sourceMaps = Boolean(outputSourceMapName)
  options = {
    ...options,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps,
    sourceFileName: sourceLocationForSourceMap,
  }

  return transpile({ inputAst, inputSource, options }).then(
    ({ code, ast, map, metadata }) => {
      if (map) {
        map.file = sourceNameForSourceMap
      }

      return {
        outputSource: code,
        outputSourceMap: map,
        outputAst: ast,
        outputAssets: {
          ...(sourceMaps ? { [outputSourceMapName]: stringifyMap(map) } : {}),
          ...(metadata.coverage ? { "coverage.json": stringifyCoverage(metadata.coverage) } : {}),
        },
      }
    },
    (error) => {
      if (error && error.code === "BABEL_PARSE_ERROR") {
        return Promise.reject({
          name: "PARSE_ERROR",
          message: transformBabelParseErrorMessage(error.message, root, options.filename),
          fileName: options.filename,
          lineNumber: error.loc.line,
          columnNumber: error.loc.column,
          // stack: error.stack
        })
      }
      return Promise.reject(error)
    },
  )
}
