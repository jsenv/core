"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transpiler = undefined;

var _babel = require("@dmail/shared-config/dist/babel.js");

var _babelCore = require("babel-core");

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var transpiler = exports.transpiler = function transpiler(context) {
  var inputRelativeLocation = context.inputRelativeLocation,
      inputSource = context.inputSource,
      inputSourceMap = context.inputSourceMap,
      inputAst = context.inputAst,
      options = context.options,
      outputSourceMapName = context.outputSourceMapName,
      getSourceNameForSourceMap = context.getSourceNameForSourceMap,
      getSourceLocationForSourceMap = context.getSourceLocationForSourceMap;

  // the truth is that we don't support global, nor amd
  // I have to check if we could support cjs but maybe we don't even support this
  // at least we support the most important: inputFormat: "es" with outputFormat: "systemjs"
  // https://github.com/systemjs/systemjs/blob/master/src/format-helpers.js#L5
  // https://github.com/systemjs/babel-plugin-transform-global-system-wrapper/issues/1

  var moduleOptions = (0, _babel.createModuleOptions)({
    inputModuleFormat: "es",
    outputModuleFormat: "systemjs"
  });

  var remapOptions = options.remap ? {
    sourceMaps: true,
    sourceMapTarget: getSourceNameForSourceMap(context),
    sourceFileName: getSourceLocationForSourceMap(context)
  } : {
    sourceMaps: false
  };

  var babelOptions = (0, _babel.mergeOptions)(moduleOptions, (0, _babel.createSyntaxOptions)(), remapOptions, {
    filename: inputRelativeLocation,
    inputSourceMap: inputSourceMap,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true
  });
  var babelConfig = (0, _babel.createConfig)(babelOptions);

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
//# sourceMappingURL=transpiler.js.map