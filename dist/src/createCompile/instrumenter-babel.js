"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.instrumenter = void 0;

var _babel = require("@dmail/shared-config/dist/babel.js");

var _babelCore = require("babel-core");

var _istanbulLibInstrument = require("istanbul-lib-instrument");

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
              inputSourceMap = this.opts.inputSourceMap || this.file.opts.inputSourceMap;
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
    rootLocation,
    inputRelativeLocation,
    inputSource,
    inputSourceMap,
    inputAst,
    outputSourceMapName,
    options,
    getSourceNameForSourceMap,
    getSourceLocationForSourceMap
  } = context;
  const remapOptions = options.remap ? {
    sourceMaps: true,
    sourceMapTarget: getSourceNameForSourceMap(context),
    sourceFileName: getSourceLocationForSourceMap(context)
  } : {
    sourceMaps: false
  };
  const babelOptions = (0, _babel.mergeOptions)(remapOptions, // we need the syntax option to enable rest spread in case it's used
  (0, _babel.createSyntaxOptions)(), {
    root: rootLocation,
    filename: inputRelativeLocation,
    inputSourceMap,
    babelrc: false,
    // trust only these options, do not read any babelrc config file
    ast: true
  });
  const babelConfig = (0, _babel.createConfig)(babelOptions);
  babelConfig.plugins.push(createInstrumentPlugin({
    filename: inputRelativeLocation,
    useInlineSourceMaps: false
  }));

  if (inputAst) {
    const result = (0, _babelCore.transformFromAst)(inputAst, inputSource, babelConfig);
    return {
      outputSource: result.code,
      outputSourceMap: result.map,
      outputAst: result.ast,
      outputAssets: {
        [outputSourceMapName]: JSON.stringify(result.map, null, "  "),
        "coverage.json": JSON.stringify(result.metadata.coverage, null, "  ")
      }
    };
  }

  const {
    code,
    ast,
    map,
    metadata
  } = (0, _babelCore.transform)(inputSource, babelConfig);
  return {
    outputSource: code,
    outputSourceMap: map,
    outputAst: ast,
    outputAssets: {
      [outputSourceMapName]: JSON.stringify(map, null, "  "),
      "coverage.json": JSON.stringify(metadata.coverage, null, "  ")
    }
  };
};

exports.instrumenter = instrumenter;
//# sourceMappingURL=instrumenter-babel.js.map