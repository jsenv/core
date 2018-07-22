import {
  createConfig,
  createModuleOptions,
  createSyntaxOptions,
  mergeOptions,
} from "@dmail/shared-config/dist/babel.js"
import { transform, transformFromAst } from "babel-core"
import moduleFormats from "js-module-formats"

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

export const transformer = ({ code, map, ast }, { sourceMap }, { inputRelativeLocation }) => {
  // https://babeljs.io/docs/core-packages/#options
  const inputModuleFormat = inputRelativeLocation.endsWith(".mjs") ? "es" : detectModuleFormat(code)
  const outputModuleFormat = "systemjs"
  const moduleOptions = createModuleOptions({ inputModuleFormat, outputModuleFormat })

  const babelOptions = mergeOptions(moduleOptions, createSyntaxOptions(), {
    filenameRelative: inputRelativeLocation,
    sourceMaps: sourceMap !== "none",
    inputSourceMap: map,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
  })
  const babelConfig = createConfig(babelOptions)

  if (ast) {
    return transformFromAst(ast, code, babelConfig)
  }
  return transform(code, babelConfig)
}
