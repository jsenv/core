// https://github.com/jsenv/core/blob/master/src/api/util/transpiler.js

import { passed } from "@dmail/action"
import { transform } from "babel-core"
import moduleFormats from "js-module-formats"
import { createBabelOptions } from "@dmail/shared-config"

export const normalizeSeparation = (filename) => filename.replace(/\\/g, "/")

const detectModuleInput = (input) => {
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

const defaultOptions = {
  minify: false,
}

export const createCompiler = ({ ...compilerOptions } = {}) => {
  const compile = ({ inputRelativeLocation, input, ...compileOptions }) => {
    // https://babeljs.io/docs/core-packages/#options
    const options = { ...defaultOptions, ...compilerOptions, ...compileOptions }
    const moduleInput = detectModuleInput(input)
    const moduleOutput = "systemjs"
    const babelOptions = {
      ...createBabelOptions({ ...options, moduleInput, moduleOutput }),
      babelrc: false, // do not ready this file or any other babelrc
    }

    Object.assign(babelOptions, {
      filenameRelative: inputRelativeLocation,
      ast: true,
      sourceMaps: true,
      inputSourceMap: options.inputCodeSourceMap,
    })

    const { code, ast, map } = transform(input, babelOptions)

    return passed({
      code,
      ast,
      map,
    })
  }

  return { compile }
}
