"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.removeFolderDeep = exports.removeFile = exports.readFolder = exports.isFolder = exports.resolvePath = exports.normalizeSeparation = exports.isFileNotFoundError = exports.createETag = void 0;

var _crypto = _interopRequireDefault(require("crypto"));

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

var _rimraf = _interopRequireDefault(require("rimraf"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var createETag = function createETag(string) {
  if (string.length === 0) {
    // fast-path empty
    return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
  }

  var hash = _crypto.default.createHash("sha1");

  hash.update(string, "utf8");
  var result = hash.digest("base64");
  result = result.replace(/\=+$/, "");
  return "\"".concat(string.length.toString(16), "-").concat(result, "\"");
};

exports.createETag = createETag;

var isFileNotFoundError = function isFileNotFoundError(error) {
  return error && error.code === "ENOENT";
};

exports.isFileNotFoundError = isFileNotFoundError;

var normalizeSeparation = function normalizeSeparation(filename) {
  return filename.replace(/\\/g, "/");
};

exports.normalizeSeparation = normalizeSeparation;

var resolvePath = function resolvePath(from) {
  for (var _len = arguments.length, paths = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    paths[_key - 1] = arguments[_key];
  }

  return normalizeSeparation(_path.default.join.apply(_path.default, [from].concat(paths)));
};

exports.resolvePath = resolvePath;

var isFolder = function isFolder(filename) {
  return new Promise(function (resolve, reject) {
    _fs.default.lstat(filename, function (error, stat) {
      if (error) {
        reject(error);
      } else {
        resolve(stat.isDirectory());
      }
    });
  });
};

exports.isFolder = isFolder;

var readFolder = function readFolder(location) {
  return new Promise(function (resolve, reject) {
    _fs.default.readdir(location, function (error, filenames) {
      if (error) {
        reject(error);
      } else {
        resolve(filenames);
      }
    });
  });
};

exports.readFolder = readFolder;

var removeFile = function removeFile(location) {
  return new Promise(function (resolve, reject) {
    _fs.default.unlink(location, function (error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

exports.removeFile = removeFile;

var removeFolderDeep = function removeFolderDeep(location) {
  return new Promise(function (resolve, reject) {
    (0, _rimraf.default)(location, function (error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

exports.removeFolderDeep = removeFolderDeep;
//# sourceMappingURL=helpers.js.map