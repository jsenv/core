import { createConfig, createMinifiyOptions, mergeOptions } from "@dmail/shared-config"
import { transform, transformFromAst } from "babel-core"

export const minifier = ({ code, ast, map }, { sourceMap }) => {
  const babelConfig = createConfig(
    mergeOptions(createMinifiyOptions(), {
      sourceMaps: sourceMap,
      inputSourceMap: map,
      babelrc: false, // trust only these options, do not read any babelrc config file
      ast: true,
    }),
  )

  if (ast) {
    return transformFromAst(ast, code, babelConfig)
  }
  return transform(code, babelConfig)
}
