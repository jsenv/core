import { transpiler } from "./transpiler.js"
import { remapper } from "./remapper.js"
import { contextToSourceMapMeta } from "./contextToSourceMapMeta.js"

export const compile = ({
  root,
  inputName,
  inputSource,
  inputSourceMap,
  inputAst,

  transpile = true,
  plugins = [],
  remap = true,
  remapMethod = "comment", // 'comment', 'inline'

  outputName,
}) => {
  const context = {
    root,
    inputName,
    inputSource,
    inputSourceMap,
    inputAst,
    transpile,
    plugins,
    remap,
    remapMethod,
    outputName,
  }

  if (remap) {
    Object.assign(context, contextToSourceMapMeta(context))
  }

  const transformers = [...(transpile ? [transpiler] : []), ...(remap ? [remapper] : [])]

  return transformers
    .reduce(
      (previous, transformer) => {
        return previous.then(({ outputSource, outputAst, outputSourceMap, assetMap }) => {
          return transformer({
            ...context,
            inputSource: outputSource,
            inputSourceMap: outputSourceMap,
            inputAst: outputAst,
            assetMap,
          })
        })
      },
      Promise.resolve({
        outputSource: inputSource,
        outputAst: inputAst,
        outputSourceMap: inputSourceMap,
        assetMap: {},
      }),
    )
    .then(({ outputSource, outputSourceMap, outputAst, assetMap }) => {
      return {
        outputSource,
        outputSourceMap,
        outputAst,
        assetMap,
      }
    })
}
