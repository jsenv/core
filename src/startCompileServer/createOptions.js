import moduleFormats from "js-module-formats"
import { createBabelOptions } from "@dmail/shared-config"

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

export const createOptions = (options, { input, inputRelativeLocation }) => {
  // https://babeljs.io/docs/core-packages/#options
  const moduleInputFormat = detectModuleFormat(input)
  const moduleOutputFormat = "systemjs"
  const babelOptions = {
    ...createBabelOptions({ ...options, moduleInputFormat, moduleOutputFormat }),
    babelrc: false, // do not ready this file or any other babelrc
    filenameRelative: inputRelativeLocation,
    ast: true,
    sourceMaps: true,
    inputSourceMap: options.inputCodeSourceMap,
  }

  return babelOptions
}
