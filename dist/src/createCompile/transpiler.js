"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transpiler = void 0;

var _transpileWithBabel = require("./transpileWithBabel.js");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const transpiler = context => {
  const {
    inputRelativeLocation,
    inputSource,
    inputSourceMap,
    inputAst,
    options,
    outputSourceMapName,
    getBabelPlugins,
    getSourceNameForSourceMap,
    getSourceLocationForSourceMap
  } = context;
  const babelOptions = {
    plugins: getBabelPlugins(),
    filename: inputRelativeLocation,
    inputSourceMap
  };
  return (0, _transpileWithBabel.transpileWithBabel)(_objectSpread({
    inputAst,
    inputSource,
    options: babelOptions
  }, options.remap ? {
    outputSourceMapName,
    sourceLocationForSourceMap: getSourceLocationForSourceMap(context),
    sourceNameForSourceMap: getSourceNameForSourceMap(context)
  } : {}));
};

exports.transpiler = transpiler;
//# sourceMappingURL=transpiler.js.map