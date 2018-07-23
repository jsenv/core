// why not https://github.com/istanbuljs/babel-plugin-istanbul ?
// https://github.com/guybedford/systemjs-istanbul/blob/master/index.js
import istanbul from "istanbul"
import remapIstanbul from "remap-istanbul/lib/remap"
import { SourceMapConsumer, SourceMapGenerator } from "source-map"

export const getCoverage = ({ globalName }) => {
  return global[globalName]
}

// remap coverage will be needed later so that our coverage object
// is remapped using sourcemaps
export const remapCoverage = (coverage) => {
  return remapIstanbul(coverage)
}

export const getCoverageGlobalVariableName = () => {
  for (const key in global) {
    if (key.match(/\$\$cov_\d+\$\$/)) {
      return key
    }
  }
  return null
}

export const instrumenter = (
  { code, map, ast, ...rest },
  { coverageGlobalVariabeName = "__coverage__" },
  { inputRelativeLocation },
) => {
  // http://gotwarlost.github.io/istanbul/public/apidocs/classes/Instrumenter.html
  const istanbulInstrumenter = new istanbul.Instrumenter({
    coverageVariable: coverageGlobalVariabeName,
    esModules: true,
    // tod: put this to true if the instrumented module is anonymous
    // a way to know if the module is register anonymously doing System.module is to check if it's adress looks like
    // '<Anonymous Module ' + ++anonCnt + '>';
    // https://github.com/ModuleLoader/es6-module-loader/issues/489
    // but if the anonymous module provide an adress you're fucked
    // also when a normal module use <Anonymous Module 1> name
    // in both cases we would consider it as anonymous by mistake
    // for now we will enable embedSource if the load.address includes anonymous somewhere
    embedSource: inputRelativeLocation.includes("anonymous"),
    codeGenerationOptions: {
      // il faut passer le fichier d'origine, sauf que ce fichier n'est pas dispo sur le fs puisque transpiled
      // il le sera ptet par la suite
      sourceMap: inputRelativeLocation,
      sourceContent: code,
      sourceMapWithCode: true,
      file: inputRelativeLocation,
    },
  })

  const outputCode = ast
    ? istanbulInstrumenter.instrumentASTSync(ast, inputRelativeLocation, code)
    : istanbulInstrumenter.instrumentSync(code, inputRelativeLocation)
  const outputCodeSourceMap = istanbulInstrumenter.lastSourceMap()

  if (map) {
    // https://github.com/karma-runner/karma-coverage/pull/146/files
    const inputCodeSourceMapConsumer = new SourceMapConsumer(map)
    const intrumentedCodeSourceMapConsumer = new SourceMapConsumer(outputCodeSourceMap)
    const generator = SourceMapGenerator.fromSourceMap(intrumentedCodeSourceMapConsumer)
    generator.applySourceMap(inputCodeSourceMapConsumer)

    return {
      code: outputCode,
      map: JSON.parse(generator.toString()),
      ...rest,
    }
  }

  return {
    code: outputCode,
    map: outputCodeSourceMap,
    ...rest,
  }
}
