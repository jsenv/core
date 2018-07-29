import {
  createConfig,
  createModuleOptions,
  createSyntaxOptions,
  mergeOptions,
} from "@dmail/shared-config/dist/babel"
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

export const transpiler = ({
  inputRelativeLocation,
  inputSource,
  inputSourceMap,
  inputAst,
  options,
}) => {
  // https://babeljs.io/docs/core-packages/#options
  const inputModuleFormat = inputRelativeLocation.endsWith(".mjs")
    ? "es"
    : detectModuleFormat(inputSource)
  const outputModuleFormat = "systemjs"
  const moduleOptions = createModuleOptions({ inputModuleFormat, outputModuleFormat })

  const babelOptions = mergeOptions(moduleOptions, createSyntaxOptions(), {
    filenameRelative: inputRelativeLocation,
    sourceMaps: options.remap,
    inputSourceMap,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true,
  })
  const babelConfig = createConfig(babelOptions)

  if (inputAst) {
    const { code, ast, map } = transformFromAst(inputAst, inputSource, babelConfig)
    return {
      outputSource: code,
      outputSourceMap: map,
      outputAst: ast,
    }
  }

  const { code, ast, map } = transform(inputSource, babelConfig)
  return {
    outputSource: code,
    outputSourceMap: map,
    outputAst: ast,
  }
}
