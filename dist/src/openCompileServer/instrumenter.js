"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.instrumenter = exports.getCoverageGlobalVariableName = exports.remapCoverage = exports.getCoverage = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _istanbul = require("istanbul");

var _istanbul2 = _interopRequireDefault(_istanbul);

var _remap = require("remap-istanbul/lib/remap");

var _remap2 = _interopRequireDefault(_remap);

var _sourceMap = require("source-map");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } // why not https://github.com/istanbuljs/babel-plugin-istanbul ?
// https://github.com/guybedford/systemjs-istanbul/blob/master/index.js


var getCoverage = exports.getCoverage = function getCoverage(_ref) {
  var globalName = _ref.globalName;

  return global[globalName];
};

// remap coverage will be needed later so that our coverage object
// is remapped using sourcemaps
var remapCoverage = exports.remapCoverage = function remapCoverage(coverage) {
  return (0, _remap2["default"])(coverage);
};

var getCoverageGlobalVariableName = exports.getCoverageGlobalVariableName = function getCoverageGlobalVariableName() {
  for (var key in global) {
    if (key.match(/\$\$cov_\d+\$\$/)) {
      return key;
    }
  }
  return null;
};

var instrumenter = function instrumenter(_ref2, _ref3, _ref4) {
  var code = _ref2.code,
      map = _ref2.map,
      ast = _ref2.ast,
      rest = _objectWithoutProperties(_ref2, ["code", "map", "ast"]);

  var _ref3$coverageGlobalV = _ref3.coverageGlobalVariabeName,
      coverageGlobalVariabeName = _ref3$coverageGlobalV === undefined ? "__coverage__" : _ref3$coverageGlobalV;
  var inputRelativeLocation = _ref4.inputRelativeLocation;

  // http://gotwarlost.github.io/istanbul/public/apidocs/classes/Instrumenter.html
  var istanbulInstrumenter = new _istanbul2["default"].Instrumenter({
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
      file: inputRelativeLocation
    }
  });

  var outputCode = ast ? istanbulInstrumenter.instrumentASTSync(ast, inputRelativeLocation, code) : istanbulInstrumenter.instrumentSync(code, inputRelativeLocation);
  var outputCodeSourceMap = istanbulInstrumenter.lastSourceMap();

  if (map) {
    // https://github.com/karma-runner/karma-coverage/pull/146/files
    var inputCodeSourceMapConsumer = new _sourceMap.SourceMapConsumer(map);
    var intrumentedCodeSourceMapConsumer = new _sourceMap.SourceMapConsumer(outputCodeSourceMap);
    var generator = _sourceMap.SourceMapGenerator.fromSourceMap(intrumentedCodeSourceMapConsumer);
    generator.applySourceMap(inputCodeSourceMapConsumer);

    return _extends({
      code: outputCode,
      map: JSON.parse(generator.toString())
    }, rest);
  }

  return _extends({
    code: outputCode,
    map: outputCodeSourceMap
  }, rest);
};
exports.instrumenter = instrumenter;
//# sourceMappingURL=instrumenter.js.map