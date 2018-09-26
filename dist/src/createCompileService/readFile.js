"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.readFile = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _index = require("../createFileService/index.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const readFile = ({
  location,
  errorHandler
}) => {
  return new Promise((resolve, reject) => {
    _fs.default.readFile(location, (error, buffer) => {
      if (error) {
        if (errorHandler && errorHandler(error)) {
          resolve({
            error
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