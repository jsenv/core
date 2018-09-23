"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.instrumenter = undefined;

var _babel = require("@dmail/shared-config/dist/babel.js");

var _babelCore = require("babel-core");

var _istanbulLibInstrument = require("istanbul-lib-instrument");

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// https://github.com/istanbuljs/babel-plugin-istanbul/blob/321740f7b25d803f881466ea819d870f7ed6a254/src/index.js

var createInstrumentPlugin = function createInstrumentPlugin() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      filename = _ref.filename,
      _ref$useInlineSourceM = _ref.useInlineSourceMaps,
      useInlineSourceMaps = _ref$useInlineSourceM === undefined ? false : _ref$useInlineSourceM;

  return function (_ref2) {
    var types = _ref2.types;

    return {
      visitor: {
        Program: {
          enter: function enter(path) {
            this.__dv__ = null;

            var inputSourceMap = void 0;
            if (useInlineSourceMaps) {
              inputSourceMap = this.opts.inputSourceMap || this.file.opts.inputSourceMap;
            } else {
              inputSourceMap = this.opts.inputSourceMap;
            }

            this.__dv__ = (0, _istanbulLibInstrument.programVisitor)(types, filename, {
              coverageVariable: "__coverage__",
              inputSourceMap: inputSourceMap
            });
            this.__dv__.enter(path);
          },
          exit: function exit(path) {
            if (!this.__dv__) {
              return;
            }
            var object = this.__dv__.exit(path);
            // object got two properties: fileCoverage and sourceMappingURL
            this.file.metadata.coverage = object.fileCoverage;
          }
        }
      }
    };
  };
};

var instrumenter = exports.instrumenter = function instrumenter(context) {
  var _outputAssets2;

  var inputRelativeLocation = context.inputRelativeLocation,
      inputSource = context.inputSource,
      inputSourceMap = context.inputSourceMap,
      inputAst = context.inputAst,
      outputSourceMapName = context.outputSourceMapName,
      options = context.options,
      getSourceNameForSourceMap = context.getSourceNameForSourceMap,
      getSourceLocationForSourceMap = context.getSourceLocationForSourceMap;


  var remapOptions = options.remap ? {
    sourceMaps: true,
    sourceMapTarget: getSourceNameForSourceMap(context),
    sourceFileName: getSourceLocationForSourceMap(context)
  } : {
    sourceMaps: false
  };

  var babelOptions = (0, _babel.mergeOptions)(remapOptions,
  // we need the syntax option to enable rest spread in case it's used
  (0, _babel.createSyntaxOptions)(), {
    filename: inputRelativeLocation,
    inputSourceMap: inputSourceMap,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true
  });
  var babelConfig = (0, _babel.createConfig)(babelOptions);
  babelConfig.plugins.push(createInstrumentPlugin({ filename: inputRelativeLocation, useInlineSourceMaps: false }));

  if (inputAst) {
    var _outputAssets;

    var result = (0, _babelCore.transformFromAst)(inputAst, inputSource, babelConfig);
    return {
      outputSource: result.code,
      outputSourceMap: result.map,
      outputAst: result.ast,
      outputAssets: (_outputAssets = {}, _defineProperty(_outputAssets, outputSourceMapName, JSON.stringify(result.map, null, "  ")), _defineProperty(_outputAssets, "coverage.json", JSON.stringify(result.metadata.coverage, null, "  ")), _outputAssets)
    };
  }

  var _transform = (0, _babelCore.transform)(inputSource, babelConfig),
      code = _transform.code,
      ast = _transform.ast,
      map = _transform.map,
      metadata = _transform.metadata;

  return {
    outputSource: code,
    outputSourceMap: map,
    outputAst: ast,
    outputAssets: (_outputAssets2 = {}, _defineProperty(_outputAssets2, outputSourceMapName, JSON.stringify(map, null, "  ")), _defineProperty(_outputAssets2, "coverage.json", JSON.stringify(metadata.coverage, null, "  ")), _outputAssets2)
  };
};
//# sourceMappingURL=instrumenter-babel.js.map