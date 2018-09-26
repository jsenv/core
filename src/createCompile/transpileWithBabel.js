import { transformAsync, transformFromAstAsync } from "@babel/core"

const stringifyMap = (object) => JSON.stringify(object, null, "  ")

const stringifyCoverage = (object) => JSON.stringify(object, null, "  ")

const transpile = ({ inputAst, inputSource, options }) => {
  if (inputAst) {
    return transformFromAstAsync(inputAst, inputSource, options)
  }
  return transformAsync(inputSource, options)
}

export const transpileWithBabel = ({
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

  return transpile({ inputAst, inputSource, options }).then(({ code, ast, map, metadata }) => {
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
  })
}
