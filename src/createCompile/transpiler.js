import { transpileWithBabel } from "./transpileWithBabel.js"

export const transpiler = (context) => {
  const {
    inputRelativeLocation,
    inputSource,
    inputSourceMap,
    inputAst,
    options,
    outputSourceMapName,
    getBabelPlugins,
    getSourceNameForSourceMap,
    getSourceLocationForSourceMap,
  } = context

  const babelOptions = {
    plugins: getBabelPlugins(),
    filename: inputRelativeLocation,
    inputSourceMap,
  }

  return transpileWithBabel({
    inputAst,
    inputSource,
    options: babelOptions,
    ...(options.remap
      ? {
          outputSourceMapName,
          sourceLocationForSourceMap: getSourceLocationForSourceMap(context),
          sourceNameForSourceMap: getSourceNameForSourceMap(context),
        }
      : {}),
  })
}
