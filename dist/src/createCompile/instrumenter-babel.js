"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.instrumenter = void 0;

var _istanbulLibInstrument = require("istanbul-lib-instrument");

var _transpileWithBabel = require("./transpileWithBabel.js");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// https://github.com/istanbuljs/babel-plugin-istanbul/blob/321740f7b25d803f881466ea819d870f7ed6a254/src/index.js
const createInstrumentPlugin = ({
  filename,
  useInlineSourceMaps = false
} = {}) => {
  return ({
    types
  }) => {
    return {
      visitor: {
        Program: {
          enter(path) {
            this.__dv__ = null;
            let inputSourceMap;

            if (useInlineSourceMaps) {
              // https://github.com/istanbuljs/babel-plugin-istanbul/commit/a9e15643d249a2985e4387e4308022053b2cd0ad#diff-1fdf421c05c1140f6d71444ea2b27638R65
              inputSourceMap = this.opts.inputSourceMap || this.file.inputMap ? this.file.inputMap.sourcemap : null;
            } else {
              inputSourceMap = this.opts.inputSourceMap;
            }

            this.__dv__ = (0, _istanbulLibInstrument.programVisitor)(types, filename, {
              coverageVariable: "__coverage__",
              inputSourceMap
            });

            this.__dv__.enter(path);
          },

          exit(path) {
            if (!this.__dv__) {
              return;
            }

            const object = this.__dv__.exit(path); // object got two properties: fileCoverage and sourceMappingURL


            this.file.metadata.coverage = object.fileCoverage;
          }

        }
      }
    };
  };
};

const instrumenter = context => {
  const {
    inputRelativeLocation,
    inputSource,
    inputSourceMap,
    inputAst,
    outputSourceMapName,
    options,
    getSourceNameForSourceMap,
    getSourceLocationForSourceMap
  } = context;
  const babelOptions = {
    plugins: [// we are missing some plugins here, the syntax plugins are required to be able to traverse the tree no ?
    // yes indeed, we could copy/paste all syntax plugins here
    createInstrumentPlugin({
      filename: inputRelativeLocation,
      useInlineSourceMaps: false
    })],
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

exports.instrumenter = instrumenter;
//# sourceMappingURL=instrumenter-babel.js.map