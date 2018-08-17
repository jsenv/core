import { identifier } from "./identifier.js"
import { instrumenter as defaultInstrumenter } from "./instrumenter-babel.js"
import { minifier as defaultMinifier } from "./minifier.js"
import { optimizer as defaultOptimizer } from "./optimizer.js"
import { remapper } from "./remapper.js"
import { transpiler as defaultTranspiler } from "./transpiler.js"

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
    // outputSource, outputAst, outputSourceMap, outputSourceMapName
    return {
      ...context,
      ...result,
    }
  })
}

export const createCompile = (
  {
    createOptions = () => {},
    transpiler = defaultTranspiler,
    minifier = defaultMinifier,
    instrumenter = defaultInstrumenter,
    optimizer = defaultOptimizer,
  } = {},
) => {
  const compile = (compileContext) => {
    return Promise.resolve(createOptions(compileContext)).then(
      (
        {
          identify = false,
          identifyMethod = "relative",
          transpile = true,
          minify = false,
          instrument = false,
          optimize = false,
          remap = true,
          remapMethod = "comment", // 'comment', 'inline'
          ...rest
        } = {},
      ) => {
        const options = {
          identify,
          identifyMethod,
          transpile,
          minify,
          instrument,
          optimize,
          remap,
          remapMethod,
          ...rest,
        }

        const generate = ({ outputRelativeLocation }) => {
          // outputRelativeLocation dependent from options:
          // there is a 1/1 relationship between JSON.stringify(options) & outputRelativeLocation
          // it means we can get options from outputRelativeLocation & vice versa
          // this is how compile output gets cached

          // no location -> cannot identify
          if (!compileContext.inputRelativeLocation) {
            identify = false
          }
          // if sourceMap are appended as comment do not put any //#sourceURL=../../file.js
          // because sourceMappingURL will try to resolve against sourceURL
          if (remap) {
            identify = false
          }

          return Promise.resolve({
            ...compileContext,
            options,
            outputRelativeLocation,
            outputSource: compileContext.inputSource,
            outputSourceMap: compileContext.inputSourceMap,
            outputAst: compileContext.inputAst,
          })
            .then((context) => (transpile ? transform(context, transpiler) : context))
            .then((context) => (instrument ? transform(context, instrumenter) : context))
            .then((context) => (minify ? transform(context, minifier) : context))
            .then((context) => (optimize ? transform(context, optimizer) : context))
            .then((context) => (identify ? transform(context, identifier) : context))
            .then((context) => (remap ? transform(context, remapper) : context))
            .then(({ outputSource, outputSourceMap, outputSourceMapName }) => {
              if (outputSourceMapName) {
                return {
                  output: outputSource,
                  outputAssets: [
                    {
                      name: outputSourceMapName,
                      content: JSON.stringify(outputSourceMap, null, "  "),
                    },
                  ],
                }
              }
              return {
                output: outputSource,
                outputAssets: [],
              }
            })
        }

        return { options, generate }
      },
    )
  }

  return compile
}
