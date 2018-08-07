import {
  createConfig,
  createModuleOptions,
  createSyntaxOptions,
  mergeOptions,
} from "@dmail/shared-config/dist/babel"
import { transform, transformFromAst } from "babel-core"
import moduleFormats from "js-module-formats"
import path from "path"
import { normalizeSeparation } from "../createCompileService/helpers.js"

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
  rootLocation,
  filename,
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
  // the truth is that we don't support global, nor amd
  // I have to check if we could support cjs but maybe we don't even support this
  // at least we support the most important: inputFormat: "es" with outputFormat: "systemjs"
  // https://github.com/systemjs/systemjs/blob/master/src/format-helpers.js#L5
  // https://github.com/systemjs/babel-plugin-transform-global-system-wrapper/issues/1
  const moduleOptions = createModuleOptions({ inputModuleFormat, outputModuleFormat })

  let sourceFileName
  if (options.remapByFilesystem) {
    sourceFileName = `file://${path.resolve(rootLocation, inputRelativeLocation)}`
  } else {
    const sourceLocation = path.resolve(rootLocation, inputRelativeLocation)
    const sourceMapAbstractLocation = path.resolve(rootLocation, `${filename}.map`)
    const sourceLocationRelativeToSourceMapLocation = normalizeSeparation(
      path.relative(sourceMapAbstractLocation, sourceLocation),
    )
    sourceFileName = sourceLocationRelativeToSourceMapLocation
  }

  const babelOptions = mergeOptions(moduleOptions, createSyntaxOptions(), {
    filename,
    // filenameRelative: inputRelativeLocation,
    sourceMapTarget: filename,
    sourceFileName,
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
