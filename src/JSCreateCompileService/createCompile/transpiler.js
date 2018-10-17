import { transpileWithBabel } from "./transpileWithBabel.js"

export const transpiler = (context) => {
  const {
    root,
    inputName,
    inputSource,
    inputSourceMap,
    inputAst,
    options,
    getBabelPlugins,
    sourceMapName,
    sourceMapLocationForSource,
    sourceNameForSourceMap,
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
    remap: options.remap,
    sourceMapName,
    sourceMapLocationForSource,
    sourceNameForSourceMap,
  })
}
