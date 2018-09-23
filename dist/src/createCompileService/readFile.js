"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readFile = undefined;

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _index = require("../createFileService/index.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var readFile = exports.readFile = function readFile(_ref) {
  var location = _ref.location,
      errorHandler = _ref.errorHandler;

  return new Promise(function (resolve, reject) {
    _fs2["default"].readFile(location, function (error, buffer) {
      if (error) {
        if (errorHandler && errorHandler(error)) {
          resolve({ error: error });
        } else {
          reject((0, _index.convertFileSystemErrorToResponseProperties)(error));
        }
      } else {
        resolve({ content: String(buffer) });
      }
    });
  });
};
//# sourceMappingURL=readFile.js.map