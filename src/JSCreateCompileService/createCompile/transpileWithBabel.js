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
  remap,
  sourceMapName,
  sourceLocationForSourceMap,
  sourceNameForSourceMap,
}) => {
  options = {
    ...options,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: remap,
  }

  return transpile({ inputAst, inputSource, options }).then(
    ({ code, ast, map, metadata }) => {
      if (map) {
        delete map.sourceRoot
        // we don't need sourceRoot because our path are relative or absolute to the current location
        // we could comment this line because it is not set by babel because not passed during transform

        delete map.sourcesContent
        // removing sourcesContent from map decrease the sourceMap
        // it also means client have to fetch source from server (additional http request)
        // This is the most complex scenario.
        // some client ignroe the sourcesContent property such as vscode-chrome-debugger
        // Because it's the most complex scenario and we want to ensure lcient is always able
        // to find source from the sourcemap, we explicitely delete nmap.sourcesContent

        map.sources[0] = sourceLocationForSourceMap
        // the source can be found at sourceLocationForSourceMap

        map.file = sourceNameForSourceMap
        // this file name supposed to appear in dev tools
      }

      return {
        outputSource: code,
        outputSourceMap: map,
        outputAst: ast,
        outputAssets: {
          ...(remap ? { [sourceMapName]: stringifyMap(map) } : {}),
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
