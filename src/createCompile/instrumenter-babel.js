import { createConfig, mergeOptions } from "@dmail/shared-config/dist/babel.js"
import { transform, transformFromAst } from "babel-core"
import { resolvePath } from "../createCompileService/helpers.js"

export const instrumenter = ({
  rootLocation,
  inputRelativeLocation,
  inputSource,
  inputSourceMap,
  inputAst,
  options,
}) => {
  const sourceLocation = resolvePath(rootLocation, inputRelativeLocation)

  const babelOptions = mergeOptions({
    filename: sourceLocation,
    sourceMapTarget: inputRelativeLocation,
    sourceFileName: inputRelativeLocation,
    sourceMaps: options.remap,
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
