import { transpileWithBabel } from "./transpileWithBabel.js"

export const transpiler = (context) => {
  const {
    localRoot,
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
    filename: localRoot ? `${localRoot}/${inputName}` : inputName,
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
