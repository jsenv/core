import { createConfig, createSyntaxOptions, mergeOptions } from "@dmail/shared-config/dist/babel.js"
import { transform, transformFromAst } from "babel-core"
import { programVisitor } from "istanbul-lib-instrument"

// https://github.com/istanbuljs/babel-plugin-istanbul/blob/321740f7b25d803f881466ea819d870f7ed6a254/src/index.js

const createInstrumentPlugin = ({ filename, useInlineSourceMaps = false } = {}) => {
  return ({ types }) => {
    return {
      visitor: {
        Program: {
          enter(path) {
            this.__dv__ = null

            let inputSourceMap
            if (useInlineSourceMaps) {
              inputSourceMap = this.opts.inputSourceMap || this.file.opts.inputSourceMap
            } else {
              inputSourceMap = this.opts.inputSourceMap
            }

            this.__dv__ = programVisitor(types, filename, {
              coverageVariable: "__coverage__",
              inputSourceMap,
            })
            this.__dv__.enter(path)
          },

          exit(path) {
            if (!this.__dv__) {
              return
            }
            const object = this.__dv__.exit(path)
            // object got two properties: fileCoverage and sourceMappingURL
            this.file.metadata.coverage = object.fileCoverage
          },
        },
      },
    }
  }
}

export const instrumenter = (context) => {
  const {
    inputRelativeLocation,
    inputSource,
    inputSourceMap,
    inputAst,
    outputSourceMapName,
    options,
    getSourceNameForSourceMap,
    getSourceLocationForSourceMap,
  } = context

  const remapOptions = options.remap
    ? {
        sourceMaps: true,
        sourceMapTarget: getSourceNameForSourceMap(context),
        sourceFileName: getSourceLocationForSourceMap(context),
      }
    : {
        sourceMaps: false,
      }

  const babelOptions = mergeOptions(
    remapOptions,
    // we need the syntax option to enable rest spread in case it's used
    createSyntaxOptions(),
    {
      filename: inputRelativeLocation,
      inputSourceMap,
      babelrc: false, // trust only these options, do not read any babelrc config file
      ast: true,
    },
  )
  const babelConfig = createConfig(babelOptions)
  babelConfig.plugins.push(
    createInstrumentPlugin({ filename: inputRelativeLocation, useInlineSourceMaps: false }),
  )

  if (inputAst) {
    const result = transformFromAst(inputAst, inputSource, babelConfig)
    return {
      outputSource: result.code,
      outputSourceMap: result.map,
      outputAst: result.ast,
      outputAssets: {
        [outputSourceMapName]: JSON.stringify(result.map, null, "  "),
        "coverage.json": JSON.stringify(result.metadata.coverage, null, "  "),
      },
    }
  }

  const { code, ast, map, metadata } = transform(inputSource, babelConfig)
  return {
    outputSource: code,
    outputSourceMap: map,
    outputAst: ast,
    outputAssets: {
      [outputSourceMapName]: JSON.stringify(map, null, "  "),
      "coverage.json": JSON.stringify(metadata.coverage, null, "  "),
    },
  }
}
