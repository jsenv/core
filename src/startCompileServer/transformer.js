import { transform, transformFromAst } from "babel-core"
import moduleFormats from "js-module-formats"
import { mergeBabelOptions, createModuleOptions, createSyntaxOptions } from "@dmail/shared-config"

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

export const createBabelOptions = ({ code, map }, { sourceMap }, { inputRelativeLocation }) => {
  // https://babeljs.io/docs/core-packages/#options
  const moduleInputFormat = detectModuleFormat(code)
  const moduleOutputFormat = "systemjs"

  return mergeBabelOptions(
    createModuleOptions({ moduleInputFormat, moduleOutputFormat }),
    createSyntaxOptions(),
    {
      filenameRelative: inputRelativeLocation,
      sourceMaps: sourceMap !== "none",
      inputSourceMap: map,
      babelrc: false, // trust only these options, do not read any babelrc config file
      ast: true,
    },
  )
}

export const transformer = (result, options, context) => {
  const babelOptions = createBabelOptions(result, options, context)

  if (result.ast) {
    return transformFromAst(result.ast, result.code, babelOptions)
  }
  return transform(result.code, babelOptions)
}
