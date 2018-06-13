import { transform as babelTransform } from "babel-core"
import moduleFormats from "js-module-formats"
import { createBabelOptions as createDefaultBabelOptions } from "@dmail/shared-config"

const detectModuleFormat = (input) => {
  const format = moduleFormats.detect(input)
  if (format === "es") {
    return "es"
  }
  if (format === "cjs") {
    return "cjs"
  }
  if (format === "amd") {
    return "amd"
  }
  return "global"
}

export const createBabelOptions = (
  input,
  { minify, inputCodeSourceMap },
  { inputRelativeLocation },
) => {
  // https://babeljs.io/docs/core-packages/#options
  const moduleInputFormat = detectModuleFormat(input)
  const moduleOutputFormat = "systemjs"
  const babelOptions = {
    ...createDefaultBabelOptions({ minify, moduleInputFormat, moduleOutputFormat }),
    babelrc: false, // do not ready this file or any other babelrc
    filenameRelative: inputRelativeLocation,
    ast: true,
    sourceMaps: true,
    inputSourceMap: inputCodeSourceMap,
  }

  return babelOptions
}

export const transform = (input, options, context) => {
  return babelTransform(input, createBabelOptions(input, options, context))
}
