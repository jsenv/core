"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.minifier = void 0;

var _babel = require("@dmail/shared-config/dist/babel.js");

var _babelCore = require("babel-core");

const minifier = ({
  rootLocation,
  inputSource,
  inputAst,
  inputSourceMap,
  options,
  outputSourceMapName
}) => {
  const babelConfig = (0, _babel.createConfig)((0, _babel.mergeOptions)((0, _babel.createMinifiyOptions)(), {
    sourceMaps: options.remap,
    inputSourceMap,
    root: rootLocation,
    babelrc: false,
    // trust only these options, do not read any babelrc config file
    ast: true
  }));

  if (inputAst) {
    const {
      code,
      ast,
      map
    } = (0, _babelCore.transformFromAst)(inputAst, inputSource, babelConfig);
    return {
      outputSource: code,
      outputSourceMap: map,
      outputAst: ast,
      outputAssets: {
        [outputSourceMapName]: JSON.stringify(map, null, "  ")
      }
    };
  }

  const {
    code,
    ast,
    map
  } = (0, _babelCore.transform)(inputSource, babelConfig);
  return {
    outputSource: code,
    outputSourceMap: map,
    outputAst: ast,
    outputAssets: {
      [outputSourceMapName]: JSON.stringify(map, null, "  ")
    }
  };
};

exports.minifier = minifier;
//# sourceMappingURL=minifier.js.map