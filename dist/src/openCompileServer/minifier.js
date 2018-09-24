"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.minifier = undefined;

var _sharedConfig = require("@dmail/shared-config");

var _babelCore = require("babel-core");

var minifier = exports.minifier = function minifier(_ref, _ref2) {
  var code = _ref.code,
      ast = _ref.ast,
      map = _ref.map;
  var sourceMap = _ref2.sourceMap;

  var babelConfig = (0, _sharedConfig.createConfig)((0, _sharedConfig.mergeOptions)((0, _sharedConfig.createMinifiyOptions)(), {
    sourceMaps: sourceMap,
    inputSourceMap: map,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true
  }));

  if (ast) {
    return (0, _babelCore.transformFromAst)(ast, code, babelConfig);
  }
  return (0, _babelCore.transform)(code, babelConfig);
};
//# sourceMappingURL=minifier.js.map