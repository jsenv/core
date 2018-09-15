import { createConfig, createMinifiyOptions, mergeOptions } from "@dmail/shared-config"
import { transform, transformFromAst } from "babel-core"

export const minifier = ({
  inputSource,
  inputAst,
  inputSourceMap,
  options,
  outputSourceMapName,
}) => {
  const babelConfig = createConfig(
    mergeOptions(createMinifiyOptions(), {
      sourceMaps: options.remap,
      inputSourceMap,
      babelrc: false, // trust only these options, do not read any babelrc config file
      ast: true,
    }),
  )

  if (inputAst) {
    const { code, ast, map } = transformFromAst(inputAst, inputSource, babelConfig)
    return {
      outputSource: code,
      outputSourceMap: map,
      outputAst: ast,
      outputAssets: {
        [outputSourceMapName]: JSON.stringify(map, null, "  "),
      },
    }
  }

  const { code, ast, map } = transform(inputSource, babelConfig)
  return {
    outputSource: code,
    outputSourceMap: map,
    outputAst: ast,
    outputAssets: {
      [outputSourceMapName]: JSON.stringify(map, null, "  "),
    },
  }
}
