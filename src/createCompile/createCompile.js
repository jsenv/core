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

const createDefaultOptions = ({ groupId, abstractFolderRelativeLocation }) => {
  let transpile = false
  if (abstractFolderRelativeLocation === "compiled") {
    transpile = true
  }

  let instrument = false
  if (abstractFolderRelativeLocation === "instrumented") {
    transpile = true
    instrument = true
  }

  const remap = true

  return {
    groupId,
    identify: false,
    identifyMethod: "relative",
    transpile,
    minify: false,
    instrument,
    optimize: false,
    remap,
    remapMethod: "comment", // 'comment', 'inline'
  }
}

// a refaire en utilisant project structure pour regarder si ya le meta cover
const instrumentPredicate = ({ inputRelativeLocation }) => {
  if (inputRelativeLocation.startsWith("node_modules/")) {
    return false
  }
  // it should be passed by coverFolder
  // because we are duplicating the logic about
  // what is a test file and what is a source file there
  if (inputRelativeLocation.endsWith(".test.js")) {
    return false
  }
  return true
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
    return Promise.all([createDefaultOptions(compileContext), createOptions(compileContext)]).then(
      ([defaultOptions, customOptions = {}]) => {
        const options = {
          ...defaultOptions,
          ...customOptions,
        }
        let { identify, transpile, instrument, minify, optimize, remap } = options

        const generate = (generateContext) => {
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
            outputSource: compileContext.inputSource,
            outputSourceMap: compileContext.inputSourceMap,
            // folder/file.js -> file.js.map
            outputSourceMapName: `${path.basename(compileContext.inputRelativeLocation)}.map`,
            outputAst: compileContext.inputAst,
            getSourceNameForSourceMap: ({ rootLocation, inputRelativeLocation }) => {
              return resolvePath(rootLocation, inputRelativeLocation)
            },
            getSourceLocationForSourceMap: ({ inputRelativeLocation }) => {
              return inputRelativeLocation
            },
            ...compileContext,
            ...generateContext,
            options,
          })
            .then((context) => (transpile ? transform(context, transpiler) : context))
            .then((context) => {
              if (instrument && instrumentPredicate(context)) {
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
      },
    )
  }

  return compile
}
