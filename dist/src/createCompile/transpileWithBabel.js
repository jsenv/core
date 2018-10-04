"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.transpileWithBabel = void 0;

var _core = require("@babel/core");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const stringifyMap = object => JSON.stringify(object, null, "  ");

const stringifyCoverage = object => JSON.stringify(object, null, "  ");

const transpile = ({
  inputAst,
  inputSource,
  options
}) => {
  if (inputAst) {
    return (0, _core.transformFromAstAsync)(inputAst, inputSource, options);
  }

  return (0, _core.transformAsync)(inputSource, options);
};

const transpileWithBabel = ({
  inputAst,
  inputSource,
  options,
  outputSourceMapName,
  sourceLocationForSourceMap,
  sourceNameForSourceMap
}) => {
  const sourceMaps = Boolean(outputSourceMapName);
  options = _objectSpread({}, options, {
    babelrc: false,
    // trust only these options, do not read any babelrc config file
    ast: true,
    sourceMaps,
    sourceFileName: sourceLocationForSourceMap
  });
  return transpile({
    inputAst,
    inputSource,
    options
  }).then(({
    code,
    ast,
    map,
    metadata
  }) => {
    if (map) {
      map.file = sourceNameForSourceMap;
    }

    return {
      outputSource: code,
      outputSourceMap: map,
      outputAst: ast,
      outputAssets: _objectSpread({}, sourceMaps ? {
        [outputSourceMapName]: stringifyMap(map)
      } : {}, metadata.coverage ? {
        "coverage.json": stringifyCoverage(metadata.coverage)
      } : {})
    };
  });
};

exports.transpileWithBabel = transpileWithBabel;
//# sourceMappingURL=transpileWithBabel.js.map