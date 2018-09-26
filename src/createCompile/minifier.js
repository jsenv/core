import { transform, transformFromAst } from "@babel/core"

export const minifier = ({
  rootLocation,
  inputSource,
  inputAst,
  inputSourceMap,
  options,
  outputSourceMapName,
}) => {
  const babelOptions = {
    plugins: [], // we need a list of plugin that minify the outputs
    sourceMaps: options.remap,
    inputSourceMap,
    root: rootLocation,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
  }

  if (inputAst) {
    const { code, ast, map } = transformFromAst(inputAst, inputSource, babelOptions)
    return {
      outputSource: code,
      outputSourceMap: map,
      outputAst: ast,
      outputAssets: {
        [outputSourceMapName]: JSON.stringify(map, null, "  "),
      },
    }
  }

  const { code, ast, map } = transform(inputSource, babelOptions)
  return {
    outputSource: code,
    outputSourceMap: map,
    outputAst: ast,
    outputAssets: {
      [outputSourceMapName]: JSON.stringify(map, null, "  "),
    },
  }
}
