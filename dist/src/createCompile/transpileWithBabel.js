"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transpileWithBabel = void 0;

var _core = require("@babel/core");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var stringifyMap = function stringifyMap(object) {
  return JSON.stringify(object, null, "  ");
};

var stringifyCoverage = function stringifyCoverage(object) {
  return JSON.stringify(object, null, "  ");
};

var transpile = function transpile(_ref) {
  var inputAst = _ref.inputAst,
      inputSource = _ref.inputSource,
      options = _ref.options;

  if (inputAst) {
    return (0, _core.transformFromAstAsync)(inputAst, inputSource, options);
  }

  return (0, _core.transformAsync)(inputSource, options);
};

var transpileWithBabel = function transpileWithBabel(_ref2) {
  var inputAst = _ref2.inputAst,
      inputSource = _ref2.inputSource,
      options = _ref2.options,
      outputSourceMapName = _ref2.outputSourceMapName,
      sourceLocationForSourceMap = _ref2.sourceLocationForSourceMap,
      sourceNameForSourceMap = _ref2.sourceNameForSourceMap;
  var sourceMaps = Boolean(outputSourceMapName);
  options = _objectSpread({}, options, {
    babelrc: false,
    // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps: sourceMaps,
    sourceFileName: sourceLocationForSourceMap
  });
  return transpile({
    inputAst: inputAst,
    inputSource: inputSource,
    options: options
  }).then(function (_ref3) {
    var code = _ref3.code,
        ast = _ref3.ast,
        map = _ref3.map,
        metadata = _ref3.metadata;

    if (map) {
      map.file = sourceNameForSourceMap;
    }

    return {
      outputSource: code,
      outputSourceMap: map,
      outputAst: ast,
      outputAssets: _objectSpread({}, sourceMaps ? _defineProperty({}, outputSourceMapName, stringifyMap(map)) : {}, metadata.coverage ? {
        "coverage.json": stringifyCoverage(metadata.coverage)
      } : {})
    };
  });
};

exports.transpileWithBabel = transpileWithBabel;
//# sourceMappingURL=transpileWithBabel.js.map