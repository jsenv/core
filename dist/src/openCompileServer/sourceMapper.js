"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sourceMapper = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

var writeSourceMapLocation = function writeSourceMapLocation(_ref) {
  var code = _ref.code,
      location = _ref.location;

  return code + "\n//# sourceMappingURL=" + location;
};

var writeSourceMapBase64 = function writeSourceMapBase64(code, map) {
  var mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64");
  return writeSourceMapLocation({
    code: code,
    location: "data:application/json;charset=utf-8;base64," + mapAsBase64
  });
};

var writeSourceMapComment = function writeSourceMapComment(code, name, // TODO: use this argument instead of appending .map on clientLocation & serverLocation
_ref2) {
  var rootLocation = _ref2.rootLocation,
      compiledFolderRelativeLocation = _ref2.compiledFolderRelativeLocation,
      inputRelativeLocation = _ref2.inputRelativeLocation,
      outputRelativeLocation = _ref2.outputRelativeLocation;

  // client thinks we are at compiled/folder/file.js
  var clientLocation = _path2["default"].resolve(rootLocation, compiledFolderRelativeLocation + "/" + inputRelativeLocation + ".map");
  // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
  var serverLocation = _path2["default"].resolve(rootLocation, outputRelativeLocation) + ".map";
  // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js.map
  var relativeLocation = _path2["default"].relative(clientLocation, serverLocation);

  return writeSourceMapLocation({ code: code, location: relativeLocation });
};

var sourceMapper = function sourceMapper(_ref3, _ref4, context) {
  var code = _ref3.code,
      map = _ref3.map,
      rest = _objectWithoutProperties(_ref3, ["code", "map"]);

  var sourceMapLocation = _ref4.sourceMapLocation;

  if (typeof map === "object") {
    // delete map.sourcesContent
    // we could remove sources content, they can be fetched from server
    // removing them will decrease size of sourceMap BUT force
    // the client to fetch the source resulting in an additional http request

    // we could delete map.sourceRoot to ensure clientLocation is absolute
    // but it's not set anyway because not passed to babel during compilation

    if (sourceMapLocation === "inline") {
      return _extends({
        code: writeSourceMapBase64(code, map, context),
        map: map
      }, rest);
    }
    if (sourceMapLocation === "comment") {
      // folder/file.js -> file.js.map
      var name = _path2["default"].basename(context.inputRelativeLocation) + ".map";

      return _extends({
        code: writeSourceMapComment(code, name, context),
        map: map,
        mapName: name
      }, rest);
    }
  }

  return _extends({ code: code, map: map }, rest);
};
exports.sourceMapper = sourceMapper;
//# sourceMappingURL=sourceMapper.js.map