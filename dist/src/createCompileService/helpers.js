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

const createETag = string => {
  if (string.length === 0) {
    // fast-path empty
    return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
  }

  const hash = _crypto.default.createHash("sha1");

  hash.update(string, "utf8");
  let result = hash.digest("base64");
  result = result.replace(/\=+$/, "");
  return `"${string.length.toString(16)}-${result}"`;
};

exports.createETag = createETag;

const isFileNotFoundError = error => error && error.code === "ENOENT";

exports.isFileNotFoundError = isFileNotFoundError;

const normalizeSeparation = filename => filename.replace(/\\/g, "/");

exports.normalizeSeparation = normalizeSeparation;

const resolvePath = (from, ...paths) => {
  return normalizeSeparation(_path.default.join(from, ...paths));
};

exports.resolvePath = resolvePath;

const isFolder = filename => {
  return new Promise((resolve, reject) => {
    _fs.default.lstat(filename, (error, stat) => {
      if (error) {
        reject(error);
      } else {
        resolve(stat.isDirectory());
      }
    });
  });
};

exports.isFolder = isFolder;

const readFolder = location => {
  return new Promise((resolve, reject) => {
    _fs.default.readdir(location, (error, filenames) => {
      if (error) {
        reject(error);
      } else {
        resolve(filenames);
      }
    });
  });
};

exports.readFolder = readFolder;

const removeFile = location => {
  return new Promise((resolve, reject) => {
    _fs.default.unlink(location, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

exports.removeFile = removeFile;

const removeFolderDeep = location => {
  return new Promise((resolve, reject) => {
    (0, _rimraf.default)(location, error => {
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