// why not https://github.com/istanbuljs/babel-plugin-istanbul ?
// https://github.com/guybedford/systemjs-istanbul/blob/master/index.js
import istanbul from "istanbul"
// import remapIstanbul from "remap-istanbul/lib/remap" // "remap-istanbul": "0.8.4",
import { SourceMapConsumer, SourceMapGenerator } from "source-map"

// const getCoverage = ({ globalName }) => {
//   return global[globalName]
// }

// // remap coverage will be needed later so that our coverage object
// // is remapped using sourcemaps
// const remapCoverage = (coverage) => {
//   return remapIstanbul(coverage)
// }

// const getCoverageGlobalVariableName = () => {
//   for (const key in global) {
//     if (key.match(/\$\$cov_\d+\$\$/)) {
//       return key
//     }
//   }
//   return null
// }

export const instrumenter = ({
  inputRelativeLocation,
  inputSource,
  inputSourceMap,
  inputAst,
  coverageGlobalVariabeName = "__coverage__",
}) => {
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
      sourceContent: inputSource,
      sourceMapWithCode: true,
      file: inputRelativeLocation,
    },
  })

  const outputSource = inputAst
    ? istanbulInstrumenter.instrumentASTSync(inputAst, inputRelativeLocation, inputSource)
    : istanbulInstrumenter.instrumentSync(inputSource, inputRelativeLocation)
  const outputSourceMap = istanbulInstrumenter.lastSourceMap()

  if (inputSourceMap) {
    // https://github.com/karma-runner/karma-coverage/pull/146/files
    const inputCodeSourceMapConsumer = new SourceMapConsumer(inputSourceMap)
    const intrumentedCodeSourceMapConsumer = new SourceMapConsumer(outputSourceMap)
    const generator = SourceMapGenerator.fromSourceMap(intrumentedCodeSourceMapConsumer)
    generator.applySourceMap(inputCodeSourceMapConsumer)

    return {
      coverageGlobalVariabeName,
      outputSource,
      outputSourceMap: JSON.parse(generator.toString()),
    }
  }

  return {
    coverageGlobalVariabeName,
    outputSource,
    outputSourceMap,
  }
}
