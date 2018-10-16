import { transpileWithBabel } from "./transpileWithBabel.js"

export const transpiler = (context) => {
  const {
    root,
    inputName,
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
    filename: inputName,
    inputSourceMap,
  }

  return transpileWithBabel({
    root,
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
