"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.minifier = undefined;

var _babel = require("@dmail/shared-config/dist/babel.js");

var _babelCore = require("babel-core");

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var minifier = exports.minifier = function minifier(_ref) {
  var inputSource = _ref.inputSource,
      inputAst = _ref.inputAst,
      inputSourceMap = _ref.inputSourceMap,
      options = _ref.options,
      outputSourceMapName = _ref.outputSourceMapName;

  var babelConfig = (0, _babel.createConfig)((0, _babel.mergeOptions)((0, _babel.createMinifiyOptions)(), {
    sourceMaps: options.remap,
    inputSourceMap: inputSourceMap,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true
  }));

  if (inputAst) {
    var _transformFromAst = (0, _babelCore.transformFromAst)(inputAst, inputSource, babelConfig),
        _code = _transformFromAst.code,
        _ast = _transformFromAst.ast,
        _map = _transformFromAst.map;

    return {
      outputSource: _code,
      outputSourceMap: _map,
      outputAst: _ast,
      outputAssets: _defineProperty({}, outputSourceMapName, JSON.stringify(_map, null, "  "))
    };
  }

  var _transform = (0, _babelCore.transform)(inputSource, babelConfig),
      code = _transform.code,
      ast = _transform.ast,
      map = _transform.map;

  return {
    outputSource: code,
    outputSourceMap: map,
    outputAst: ast,
    outputAssets: _defineProperty({}, outputSourceMapName, JSON.stringify(map, null, "  "))
  };
};
//# sourceMappingURL=minifier.js.map