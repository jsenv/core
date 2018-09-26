import { transpileWithBabel } from "./transpileWithBabel.js"

export const minifier = (context) => {
  const {
    inputRelativeLocation,
    inputSource,
    inputAst,
    inputSourceMap,
    options,
    outputSourceMapName,
    getSourceNameForSourceMap,
    getSourceLocationForSourceMap,
  } = context

  const babelOptions = {
    // we need a list of plugin that minify the outputs
    plugins: [],
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
