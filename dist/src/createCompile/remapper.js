"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.remapper = void 0;

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var writeSourceMapLocation = function writeSourceMapLocation(_ref) {
  var source = _ref.source,
      location = _ref.location;
  return "".concat(source, "\n//# sourceMappingURL=").concat(location);
};

var remapper = function remapper(_ref2) {
  var inputSource = _ref2.inputSource,
      inputSourceMap = _ref2.inputSourceMap,
      options = _ref2.options,
      outputSourceMapName = _ref2.outputSourceMapName;

  if (_typeof(inputSourceMap) !== "object" || inputSourceMap === null) {
    return null;
  } // delete inputSourceMap.sourcesContent
  // we could remove sources content, they can be fetched from server
  // removing them will decrease size of sourceMap BUT force
  // the client to fetch the source resulting in an additional http request
  // we could delete inputSourceMap.sourceRoot to ensure clientLocation is absolute
  // but it's not set anyway because not passed to babel during compilation
  // force a browser reload


  delete inputSourceMap.sourcesContent;

  if (options.remapMethod === "inline") {
    var mapAsBase64 = new Buffer(JSON.stringify(inputSourceMap)).toString("base64");
    var outputSource = writeSourceMapLocation({
      source: inputSource,
      location: "data:application/json;charset=utf-8;base64,".concat(mapAsBase64)
    });
    return {
      outputSource: outputSource
    };
  }

  if (options.remapMethod === "comment") {
    var _outputSource = writeSourceMapLocation({
      source: inputSource,
      location: "./".concat(outputSourceMapName)
    });

    return {
      outputSource: _outputSource
    };
  }

  return null;
};

exports.remapper = remapper;
//# sourceMappingURL=remapper.js.map