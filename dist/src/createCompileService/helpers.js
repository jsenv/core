"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.removeFolderDeep = exports.removeFile = exports.readFolder = exports.resolvePath = exports.normalizeSeparation = exports.isFileNotFoundError = exports.createETag = undefined;

var _crypto = require("crypto");

var _crypto2 = _interopRequireDefault(_crypto);

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _rimraf = require("rimraf");

var _rimraf2 = _interopRequireDefault(_rimraf);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var createETag = exports.createETag = function createETag(string) {
  if (string.length === 0) {
    // fast-path empty
    return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
  }

  var hash = _crypto2["default"].createHash("sha1");
  hash.update(string, "utf8");
  var result = hash.digest("base64");
  result = result.replace(/\=+$/, "");

  return "\"" + string.length.toString(16) + "-" + result + "\"";
};

var isFileNotFoundError = exports.isFileNotFoundError = function isFileNotFoundError(error) {
  return error && error.code === "ENOENT";
};

var normalizeSeparation = exports.normalizeSeparation = function normalizeSeparation(filename) {
  return filename.replace(/\\/g, "/");
};

var resolvePath = exports.resolvePath = function resolvePath(from) {
  for (var _len = arguments.length, paths = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    paths[_key - 1] = arguments[_key];
  }

  return normalizeSeparation(_path2["default"].join.apply(_path2["default"], [from].concat(paths)));
};

var readFolder = exports.readFolder = function readFolder(location) {
  return new Promise(function (resolve, reject) {
    _fs2["default"].readdir(location, function (error, filenames) {
      if (error) {
        reject(error);
      } else {
        resolve(filenames);
      }
    });
  });
};

var removeFile = exports.removeFile = function removeFile(location) {
  return new Promise(function (resolve, reject) {
    _fs2["default"].unlink(location, function (error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

var removeFolderDeep = exports.removeFolderDeep = function removeFolderDeep(location) {
  return new Promise(function (resolve, reject) {
    (0, _rimraf2["default"])(location, function (error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};
//# sourceMappingURL=helpers.js.map