import { identifier } from "./identifier.js"
import { instrumenter as defaultInstrumenter } from "./instrumenter.js"
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
    readable = true,
  } = {},
) => {
  const compile = ({
    inputRelativeLocation,
    inputSource,
    inputSourceMap = null,
    inputAst = null,
    ...rest
  }) => {
    const compileContext = {
      inputRelativeLocation,
      inputSource,
      inputSourceMap,
      inputAst,
      ...rest,
    }

    return Promise.resolve(createOptions(compileContext)).then(
      (
        {
          identify = true,
          identifyMethod = "relative",
          transpile = true,
          minify = false,
          instrument = false,
          optimize = false,
          remap = true,
          remapMethod = "comment-relative", // 'comment-relative' or 'inline'
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
          if (!inputRelativeLocation) {
            identify = false
          }
          // if sourceMap are appended as comment do not put //#sourceURL=../../file.js
          // because chrome will not work with something like //#sourceMappingURL=../../file.js.map
          // thus breaking sourcemaps
          if (inputRelativeLocation && remapMethod === "comment-relative") {
            identify = false
          }

          return Promise.resolve({
            ...compileContext,
            options,
            outputRelativeLocation,
            outputSource: inputSource,
            outputSourceMap: inputSourceMap,
            outputAst: inputAst,
          })
            .then((context) => (transpile ? transform(context, transpiler) : context))
            .then((context) => (instrument ? transform(context, instrumenter) : context))
            .then((context) => (minify ? transform(context, minifier) : context))
            .then((context) => (optimize ? transform(context, optimizer) : context))
            .then((context) => (identify ? transform(context, identifier) : context))
            .then((context) => (remap ? transform(context, remapper) : context))
            .then(({ outputSource, outputSourceMap, outputSourceMapName }) => {
              if (outputSourceMapName) {
                const outputSourceMapString = readable
                  ? JSON.stringify(outputSourceMap, null, "  ")
                  : JSON.stringify(outputSourceMap)

                return {
                  output: outputSource,
                  outputAssets: [
                    {
                      name: outputSourceMapName,
                      content: outputSourceMapString,
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
