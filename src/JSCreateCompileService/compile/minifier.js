import { transpileWithBabel } from "./transpileWithBabel.js"

export const minifier = (context) => {
  const {
    inputName,
    inputSource,
    inputAst,
    inputSourceMap,
    options,
    sourceMapName,
    sourceLocationForSourceMap,
    sourceNameForSourceMap,
  } = context

  const babelOptions = {
    // we need a list of plugin that minify the outputs
    plugins: [],
    filename: inputName,
    inputSourceMap,
  }

  return transpileWithBabel({
    inputAst,
    inputSource,
    options: babelOptions,
    remap: options.remap,
    sourceMapName,
    sourceLocationForSourceMap,
    sourceNameForSourceMap,
  })
}
