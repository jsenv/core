"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.instrumenter = void 0;

var _istanbul = _interopRequireDefault(require("istanbul"));

var _sourceMap = require("source-map");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// why not https://github.com/istanbuljs/babel-plugin-istanbul ?
// https://github.com/guybedford/systemjs-istanbul/blob/master/index.js
// import remapIstanbul from "remap-istanbul/lib/remap" // "remap-istanbul": "0.8.4",
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
var instrumenter = function instrumenter(_ref) {
  var inputRelativeLocation = _ref.inputRelativeLocation,
      inputSource = _ref.inputSource,
      inputSourceMap = _ref.inputSourceMap,
      inputAst = _ref.inputAst,
      _ref$coverageGlobalVa = _ref.coverageGlobalVariabeName,
      coverageGlobalVariabeName = _ref$coverageGlobalVa === void 0 ? "__coverage__" : _ref$coverageGlobalVa;
  // http://gotwarlost.github.io/istanbul/public/apidocs/classes/Instrumenter.html
  var istanbulInstrumenter = new _istanbul.default.Instrumenter({
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
      file: inputRelativeLocation
    }
  });
  var outputSource = inputAst ? istanbulInstrumenter.instrumentASTSync(inputAst, inputRelativeLocation, inputSource) : istanbulInstrumenter.instrumentSync(inputSource, inputRelativeLocation);
  var outputSourceMap = istanbulInstrumenter.lastSourceMap();

  if (inputSourceMap) {
    // https://github.com/karma-runner/karma-coverage/pull/146/files
    var inputCodeSourceMapConsumer = new _sourceMap.SourceMapConsumer(inputSourceMap);
    var intrumentedCodeSourceMapConsumer = new _sourceMap.SourceMapConsumer(outputSourceMap);

    var generator = _sourceMap.SourceMapGenerator.fromSourceMap(intrumentedCodeSourceMapConsumer);

    generator.applySourceMap(inputCodeSourceMapConsumer);
    return {
      coverageGlobalVariabeName: coverageGlobalVariabeName,
      outputSource: outputSource,
      outputSourceMap: JSON.parse(generator.toString())
    };
  }

  return {
    coverageGlobalVariabeName: coverageGlobalVariabeName,
    outputSource: outputSource,
    outputSourceMap: outputSourceMap
  };
};

exports.instrumenter = instrumenter;
//# sourceMappingURL=instrumenter-istanbul.js.map