import { createConfig, mergeOptions } from "@dmail/shared-config/dist/babel.js"
import { transform, transformFromAst } from "babel-core"
import path from "path"
import { normalizeSeparation } from "../createCompileService/helpers.js"

export const instrumenter = ({
  rootLocation,
  filename,
  inputRelativeLocation,
  inputSource,
  inputSourceMap,
  inputAst,
  options,
}) => {
  const sourceLocation = path.resolve(rootLocation, inputRelativeLocation)
  const sourceMapAbstractLocation = path.resolve(rootLocation, `${filename}.map`)
  const sourceLocationRelativeToSourceMapLocation = normalizeSeparation(
    path.relative(sourceMapAbstractLocation, sourceLocation),
  )
  const sourceFileName = sourceLocationRelativeToSourceMapLocation

  const babelOptions = mergeOptions({
    filename,
    sourceMapTarget: filename,
    sourceFileName,
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
