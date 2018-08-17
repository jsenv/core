import { createConfig, mergeOptions } from "@dmail/shared-config/dist/babel.js"
import { transform, transformFromAst } from "babel-core"

export const instrumenter = ({
  inputSource,
  inputSourceMap,
  inputAst,
  options,
  getSourceNameForSourceMap,
  getSourceLocationForSourceMap,
  ...rest
}) => {
  const remapOptions = options.remap
    ? {
        sourceMaps: true,
        sourceMapTarget: getSourceNameForSourceMap(rest),
        sourceFileName: getSourceLocationForSourceMap(rest),
      }
    : {
        sourceMaps: false,
      }

  const babelOptions = mergeOptions(remapOptions, {
    filename: rest.inputRelativeLocation,
    inputSourceMap,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
    plugins: [{ name: "istanbul", enabled: true, settings: { useInlineSourceMaps: false } }],
  })
  const babelConfig = createConfig(babelOptions)

  if (inputAst) {
    const { code, ast, map } = transformFromAst(inputAst, inputSource, babelConfig)
    return {
      outputSource: code,
      outputSourceMap: map,
      outputAst: ast,
    }
  }

  const { code, ast, map } = transform(inputSource, babelConfig)
  return {
    outputSource: code,
    outputSourceMap: map,
    outputAst: ast,
  }
}
