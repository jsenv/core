"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.identifier = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

var writeSourceLocation = function writeSourceLocation(_ref) {
  var code = _ref.code,
      location = _ref.location;

  return code + "\n//# sourceURL=" + location;
};

var writeSourceURL = function writeSourceURL(code, _ref2) {
  var rootLocation = _ref2.rootLocation,
      compiledFolderRelativeLocation = _ref2.compiledFolderRelativeLocation,
      inputRelativeLocation = _ref2.inputRelativeLocation,
      outputRelativeLocation = _ref2.outputRelativeLocation;

  // client thinks we are at compiled/folder/file.js
  var clientLocation = _path2["default"].resolve(rootLocation, compiledFolderRelativeLocation + "/" + inputRelativeLocation);
  // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
  var serverLocation = _path2["default"].resolve(rootLocation, outputRelativeLocation);
  // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js
  var relativeLocation = _path2["default"].relative(clientLocation, serverLocation);

  return writeSourceLocation({ code: code, location: relativeLocation });
};

var identifier = function identifier(_ref3, options, context) {
  var code = _ref3.code,
      rest = _objectWithoutProperties(_ref3, ["code"]);

  return _extends({
    code: writeSourceURL(code, context)
  }, rest);
};
exports.identifier = identifier;
//# sourceMappingURL=identifier.js.map