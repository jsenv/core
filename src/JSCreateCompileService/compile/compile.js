import { transpiler } from "./transpiler.js"
import { remapper } from "./remapper.js"
import { contextToSourceMapMeta } from "./contextToSourceMapMeta.js"

const transform = (context, transformer) => {
  return Promise.resolve()
    .then(() =>
      transformer({
        ...context,
        inputSource: context.outputSource,
        inputSourceMap: context.outputSourceMap,
        inputAst: context.outputAst,
      }),
    )
    .then(
      ({
        code = context.outputSource,
        ast = context.outputAst,
        map = context.outputSourceMap,
        assetMap = context.assetMap,
      }) => {
        return {
          ...context,
          outputSource: code,
          outputAst: ast,
          outputSourceMap: map,
          ...assetMap,
        }
      },
    )
}

export const compile = ({
  inputName,
  inputSource,
  inputSourceMap = null,
  inputAst = null,

  transpile = true,
  plugins = [],
  remap = true,
  remapMethod = "comment", // 'comment', 'inline'
}) => {
  const context = {
    inputName,
    inputSource,
    inputSourceMap,
    inputAst,
    transpile,
    plugins,
    remap,
    remapMethod,
  }

  if (remap) {
    Object.assign(context, contextToSourceMapMeta(context))
  }

  return Promise.resolve(context)
    .then((context) => (transpile ? transform(context, transpiler) : context))
    .then((context) => (remap ? transform(context, remapper) : context))
}
