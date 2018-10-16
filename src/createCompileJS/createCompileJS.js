import { identifier } from "./identifier.js"
import { instrumenter as defaultInstrumenter } from "./instrumenter-babel.js"
import { minifier as defaultMinifier } from "./minifier.js"
import { optimizer as defaultOptimizer } from "./optimizer.js"
import { remapper } from "./remapper.js"
import { transpiler as defaultTranspiler } from "./transpiler.js"
import { resolvePath } from "../createCompileService/helpers.js"
import path from "path"

const transform = (context, transformer) => {
  return Promise.resolve(
    transformer({
      ...context,
      inputSource: context.outputSource,
      inputSourceMap: context.outputSourceMap,
      inputAst: context.outputAst,
    }),
  ).then((result) => {
    // for now result is expected to null, undefined, or an object with any properties named
    // outputSource, outputAst, outputSourceMap, outputSourceMapName, outputAssets

    if (result) {
      return {
        ...context,
        ...result,
      }
    }
    return context
  })
}

const createDefaultOptions = ({ groupId }) => {
  const remap = true

  return {
    groupId,
    identify: false,
    identifyMethod: "relative",
    transpile: true,
    minify: false,
    instrument: false,
    optimize: false,
    remap,
    remapMethod: "comment", // 'comment', 'inline'
  }
}

export const createCompileJS = (
  {
    createOptions = () => {},
    transpiler = defaultTranspiler,
    minifier = defaultMinifier,
    instrumenter = defaultInstrumenter,
    optimizer = defaultOptimizer,
    instrumentPredicate = () => true,
  } = {},
) => {
  const getOptions = (context) => {
    return Promise.all([createDefaultOptions(context), createOptions(context)]).then(
      ([defaultOptions, customOptions = {}]) => {
        return {
          ...defaultOptions,
          ...customOptions,
        }
      },
    )
  }

  const compileJS = (compileContext) => {
    return getOptions(compileContext).then((options) => {
      let { identify, transpile, instrument, minify, optimize, remap } = options
      // no location -> cannot identify
      if (!compileContext.inputRelativeLocation) {
        identify = false
      }
      // if sourceMap are appended as comment do not put any //#sourceURL=../../file.js
      // because sourceMappingURL will try to resolve against sourceURL
      if (remap) {
        identify = false
      }

      const generate = (generateContext) => {
        // generateContext.outputRelativeLocation dependent from options:
        // there is a 1/1 relationship between JSON.stringify(options) & outputRelativeLocation
        // it means we can get options from outputRelativeLocation & vice versa
        // this is how compile output gets cached

        return Promise.resolve({
          outputSource: compileContext.inputSource,
          outputSourceMap: compileContext.inputSourceMap,
          // folder/file.js -> file.js.map
          outputSourceMapName: `${path.basename(compileContext.inputName)}.map`,
          outputAst: compileContext.inputAst,
          getSourceNameForSourceMap: ({ root, inputName }) => {
            return resolvePath(root, inputName)
          },
          getSourceLocationForSourceMap: ({ inputName }) => {
            return inputName
          },
          ...compileContext,
          ...generateContext,
          options,
        })
          .then((context) => (transpile ? transform(context, transpiler) : context))
          .then((context) => {
            if (instrument && instrumentPredicate(compileContext.inputName)) {
              return transform(context, instrumenter)
            }
            return context
          })
          .then((context) => (minify ? transform(context, minifier) : context))
          .then((context) => (optimize ? transform(context, optimizer) : context))
          .then((context) => (identify ? transform(context, identifier) : context))
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
