"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.writeFile = undefined;

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _promiseSequential = require("promise-sequential");

var _promiseSequential2 = _interopRequireDefault(_promiseSequential);

var _helpers = require("./helpers.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var getFileLStat = function getFileLStat(path) {
  return new Promise(function (resolve, reject) {
    _fs2["default"].lstat(path, function (error, lstat) {
      if (error) {
        reject({ status: 500, reason: error.code });
      } else {
        resolve(lstat);
      }
    });
  });
};

var createFolder = function createFolder(_ref) {
  var location = _ref.location;

  return new Promise(function (resolve, reject) {
    _fs2["default"].mkdir(location, function (error) {
      if (error) {
        // au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
        if (error.code === "EEXIST") {
          return getFileLStat(location).then(function (stat) {
            if (stat.isDirectory()) {
              resolve();
            } else {
              reject({ status: 500, reason: "expect a directory" });
            }
          });
        }
        reject({ status: 500, reason: error.code });
      } else {
        resolve();
      }
    });
  });
};

var createFolderUntil = function createFolderUntil(_ref2) {
  var location = _ref2.location;

  var path = (0, _helpers.normalizeSeparation)(location);
  // remove first / in case path starts with / (linux)
  // because it would create a "" entry in folders array below
  // tryig to create a folder at ""
  var pathStartsWithSlash = path[0] === "/";
  if (pathStartsWithSlash) {
    path = path.slice(1);
  }
  var folders = path.split("/");

  folders.pop();

  return (0, _promiseSequential2["default"])(folders.map(function (_, index) {
    return function () {
      var folderLocation = folders.slice(0, index + 1).join("/");
      return createFolder({
        location: "" + (pathStartsWithSlash ? "/" : "") + folderLocation
      });
    };
  }));
};

var writeFile = exports.writeFile = function writeFile(_ref3) {
  var location = _ref3.location,
      string = _ref3.string;

  return createFolderUntil({ location: location }).then(function () {
    return new Promise(function (resolve, reject) {
      _fs2["default"].writeFile(location, string, function (error) {
        if (error) {
          reject({ status: 500, reason: error.code });
        } else {
          resolve();
        }
      });
    });
  });
};
//# sourceMappingURL=writeFile.js.map