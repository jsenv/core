import { minifier } from "./minifier.js"
import { optimizer } from "./optimizer.js"
import { remapper } from "./remapper.js"
import { transpiler } from "./transpiler.js"
import { contextToSourceMapMeta } from "./contextToSourceMapMeta.js"
import { createInstrumentPlugin } from "./instrumenter.js"

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
    .then((result) => {
      // result is expected to null, undefined, or an object with some or all properties named
      // outputSource, outputAst, outputSourceMap, outputAssets

      if (result) {
        return {
          ...context,
          ...result,
        }
      }

      return context
    })
}

export const createCompile = ({ instrumentPredicate = () => true, ...rest } = {}) => {
  const getOptions = ({ groupId }) => {
    return {
      transpile: true,
      minify: false,
      instrument: false,
      optimize: false,
      remap: true,
      remapMethod: "comment", // 'comment', 'inline'
      groupId,
      ...rest,
    }
  }

  const compileJS = (compileContext) => {
    return Promise.resolve()
      .then(() => getOptions(compileContext))
      .then((options) => {
        const { transpile, instrument, minify, optimize, remap } = options

        const generate = (generateContext) => {
          const context = {
            outputSource: compileContext.inputSource,
            outputSourceMap: compileContext.inputSourceMap,
            outputAst: compileContext.inputAst,
            ...compileContext,
            ...generateContext,
            options,
          }
          if (remap) {
            Object.assign(context, contextToSourceMapMeta(context))
          }
          if (instrument && instrumentPredicate(context)) {
            const getBabelPlugins = context.getBabelPlugins
            context.getBabelPlugins = () => [...getBabelPlugins(), createInstrumentPlugin(context)]
          }

          return Promise.resolve(context)
            .then((context) => (transpile ? transform(context, transpiler) : context))
            .then((context) => (minify ? transform(context, minifier) : context))
            .then((context) => (optimize ? transform(context, optimizer) : context))
            .then((context) => (remap ? transform(context, remapper) : context))
            .then(({ outputSource, outputAssets = {} }) => {
              return {
                output: outputSource,
                outputAssets: Object.keys(outputAssets).map((name) => {
                  return {
                    name,
                    content: outputAssets[name],
                  }
                }),
              }
            })
        }

        return { options, generate }
      })
  }

  return compileJS
}
