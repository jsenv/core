"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.writeFile = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _promiseSequential = _interopRequireDefault(require("promise-sequential"));

var _helpers = require("./helpers.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const getFileLStat = path => {
  return new Promise((resolve, reject) => {
    _fs.default.lstat(path, (error, lstat) => {
      if (error) {
        reject({
          status: 500,
          reason: error.code
        });
      } else {
        resolve(lstat);
      }
    });
  });
};

const createFolder = ({
  location
}) => {
  return new Promise((resolve, reject) => {
    _fs.default.mkdir(location, error => {
      if (error) {
        // au cas ou deux script essayent de crée un dossier peu importe qui y arrive c'est ok
        if (error.code === "EEXIST") {
          return getFileLStat(location).then(stat => {
            if (stat.isDirectory()) {
              resolve();
            } else {
              reject({
                status: 500,
                reason: "expect a directory"
              });
            }
          });
        }

        reject({
          status: 500,
          reason: error.code
        });
      } else {
        resolve();
      }
    });
  });
};

const createFolderUntil = ({
  location
}) => {
  let path = (0, _helpers.normalizeSeparation)(location); // remove first / in case path starts with / (linux)
  // because it would create a "" entry in folders array below
  // tryig to create a folder at ""

  const pathStartsWithSlash = path[0] === "/";

  if (pathStartsWithSlash) {
    path = path.slice(1);
  }

  const folders = path.split("/");
  folders.pop();
  return (0, _promiseSequential.default)(folders.map((_, index) => {
    return () => {
      const folderLocation = folders.slice(0, index + 1).join("/");
      return createFolder({
        location: `${pathStartsWithSlash ? "/" : ""}${folderLocation}`
      });
    };
  }));
};

const writeFile = ({
  location,
  string
}) => {
  return createFolderUntil({
    location
  }).then(() => {
    return new Promise((resolve, reject) => {
      _fs.default.writeFile(location, string, error => {
        if (error) {
          reject({
            status: 500,
            reason: error.code
          });
        } else {
          resolve();
        }
      });
    });
  });
};

exports.writeFile = writeFile;
//# sourceMappingURL=writeFile.js.map