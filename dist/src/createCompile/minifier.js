"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.minifier = void 0;

var _transpileWithBabel = require("./transpileWithBabel.js");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var minifier = function minifier(context) {
  var inputRelativeLocation = context.inputRelativeLocation,
      inputSource = context.inputSource,
      inputAst = context.inputAst,
      inputSourceMap = context.inputSourceMap,
      options = context.options,
      outputSourceMapName = context.outputSourceMapName,
      getSourceNameForSourceMap = context.getSourceNameForSourceMap,
      getSourceLocationForSourceMap = context.getSourceLocationForSourceMap;
  var babelOptions = {
    // we need a list of plugin that minify the outputs
    plugins: [],
    filename: inputRelativeLocation,
    inputSourceMap: inputSourceMap
  };
  return (0, _transpileWithBabel.transpileWithBabel)(_objectSpread({
    inputAst: inputAst,
    inputSource: inputSource,
    options: babelOptions
  }, options.remap ? {
    outputSourceMapName: outputSourceMapName,
    sourceLocationForSourceMap: getSourceLocationForSourceMap(context),
    sourceNameForSourceMap: getSourceNameForSourceMap(context)
  } : {}));
};

exports.minifier = minifier;
//# sourceMappingURL=minifier.js.map