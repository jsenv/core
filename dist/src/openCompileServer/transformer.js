"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transformer = undefined;

var _babel = require("@dmail/shared-config/dist/babel");

var _babelCore = require("babel-core");

var _jsModuleFormats = require("js-module-formats");

var _jsModuleFormats2 = _interopRequireDefault(_jsModuleFormats);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var detectModuleFormat = function detectModuleFormat(input) {
  var format = _jsModuleFormats2["default"].detect(input);
  if (format === "es") {
    return "es";
  }
  if (format === "cjs") {
    return "cjs";
  }
  if (format === "amd") {
    return "amd";
  }
  return "global";
};

var transformer = exports.transformer = function transformer(_ref, _ref2, _ref3) {
  var code = _ref.code,
      map = _ref.map,
      ast = _ref.ast;
  var sourceMap = _ref2.sourceMap;
  var inputRelativeLocation = _ref3.inputRelativeLocation;

  // https://babeljs.io/docs/core-packages/#options
  var inputModuleFormat = inputRelativeLocation.endsWith(".mjs") ? "es" : detectModuleFormat(code);
  var outputModuleFormat = "systemjs";
  var moduleOptions = (0, _babel.createModuleOptions)({ inputModuleFormat: inputModuleFormat, outputModuleFormat: outputModuleFormat });

  var babelOptions = (0, _babel.mergeOptions)(moduleOptions, (0, _babel.createSyntaxOptions)(), {
    filenameRelative: inputRelativeLocation,
    sourceMaps: sourceMap !== "none",
    inputSourceMap: map,
    babelrc: false, // trust only these options, do not read any babelrc config file
    ast: true
  });
  var babelConfig = (0, _babel.createConfig)(babelOptions);

  if (ast) {
    return (0, _babelCore.transformFromAst)(ast, code, babelConfig);
  }
  return (0, _babelCore.transform)(code, babelConfig);
};
//# sourceMappingURL=transformer.js.map