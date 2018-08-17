import {
  createConfig,
  createModuleOptions,
  createSyntaxOptions,
  mergeOptions,
} from "@dmail/shared-config/dist/babel"
import { transform, transformFromAst } from "babel-core"
import { resolvePath } from "../createCompileService/helpers.js"

export const transpiler = ({
  rootLocation,
  inputRelativeLocation,
  inputSource,
  inputSourceMap,
  inputAst,
  options,
}) => {
  // the truth is that we don't support global, nor amd
  // I have to check if we could support cjs but maybe we don't even support this
  // at least we support the most important: inputFormat: "es" with outputFormat: "systemjs"
  // https://github.com/systemjs/systemjs/blob/master/src/format-helpers.js#L5
  // https://github.com/systemjs/babel-plugin-transform-global-system-wrapper/issues/1
  const moduleOptions = createModuleOptions({
    inputModuleFormat: "es",
    outputModuleFormat: "systemjs",
  })

  const sourceLocation = resolvePath(rootLocation, inputRelativeLocation)

  const babelOptions = mergeOptions(moduleOptions, createSyntaxOptions(), {
    filename: sourceLocation,
    sourceMapTarget: inputRelativeLocation,
    sourceFileName: inputRelativeLocation,
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
