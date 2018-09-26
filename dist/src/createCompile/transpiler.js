"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transpiler = void 0;

var _babel = require("@dmail/shared-config/dist/babel.js");

var _babelCore = require("babel-core");

const transpiler = context => {
  const {
    inputRelativeLocation,
    inputSource,
    inputSourceMap,
    inputAst,
    options,
    outputSourceMapName,
    getSourceNameForSourceMap,
    getSourceLocationForSourceMap
  } = context; // the truth is that we don't support global, nor amd
  // I have to check if we could support cjs but maybe we don't even support this
  // at least we support the most important: inputFormat: "es" with outputFormat: "systemjs"
  // https://github.com/systemjs/systemjs/blob/master/src/format-helpers.js#L5
  // https://github.com/systemjs/babel-plugin-transform-global-system-wrapper/issues/1

  const moduleOptions = (0, _babel.createModuleOptions)({
    inputModuleFormat: "es",
    outputModuleFormat: "systemjs"
  });
  const remapOptions = options.remap ? {
    sourceMaps: true,
    sourceMapTarget: getSourceNameForSourceMap(context),
    sourceFileName: getSourceLocationForSourceMap(context)
  } : {
    sourceMaps: false
  };
  const babelOptions = (0, _babel.mergeOptions)(moduleOptions, (0, _babel.createSyntaxOptions)(), remapOptions, {
    filename: inputRelativeLocation,
    inputSourceMap,
    babelrc: false,
    // trust only these options, do not read any babelrc config file
    ast: true
  });
  const babelConfig = (0, _babel.createConfig)(babelOptions);

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

exports.transpiler = transpiler;
//# sourceMappingURL=transpiler.js.map