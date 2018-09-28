"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readFile = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _index = require("../createFileService/index.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var readFile = function readFile(_ref) {
  var location = _ref.location,
      errorHandler = _ref.errorHandler;
  return new Promise(function (resolve, reject) {
    _fs.default.readFile(location, function (error, buffer) {
      if (error) {
        if (errorHandler && errorHandler(error)) {
          resolve({
            error: error
          });
        } else {
          reject((0, _index.convertFileSystemErrorToResponseProperties)(error));
        }
      } else {
        resolve({
          content: String(buffer)
        });
      }
    });
  });
};

exports.readFile = readFile;
//# sourceMappingURL=readFile.js.map