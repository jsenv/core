import { transpileWithBabel } from "./transpileWithBabel.js"

export const transpiler = (context) => {
  const {
    root,
    inputName,
    inputSource,
    inputSourceMap,
    inputAst,
    plugins,
    remap,
    sourceMapName,
    sourceLocationForSourceMap,
    sourceNameForSourceMap,
  } = context

  const babelOptions = {
    plugins,
    filename: root ? `${root}/${inputName}` : inputName,
    filenameRelative: inputName,
    inputSourceMap,
  }

  return transpileWithBabel({
    inputAst,
    inputSource,
    options: babelOptions,
    remap,
    sourceMapName,
    sourceLocationForSourceMap,
    sourceNameForSourceMap,
  })
}
