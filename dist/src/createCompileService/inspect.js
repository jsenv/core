"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.inspect = void 0;

var _cache = require("./cache.js");

var _helpers = require("./helpers.js");

var _list = require("./list.js");

var _locateFile = require("./locateFile.js");

var _readFile = require("./readFile.js");

const inspect = ({
  rootLocation,
  cacheFolderRelativeLocation
}) => {
  const cacheFolderLocation = (0, _helpers.resolvePath)(rootLocation, cacheFolderRelativeLocation);
  return (0, _list.list)({
    rootLocation,
    cacheFolderRelativeLocation
  }).then(folders => {
    return Promise.all(folders.map(folder => {
      return (0, _readFile.readFile)({
        location: (0, _helpers.resolvePath)(cacheFolderLocation, folder, _cache.JSON_FILE)
      }).then(JSON.parse).then(cache => {
        const inputLocation = (0, _locateFile.locateFile)(cache.inputRelativeLocation, rootLocation);
        return (0, _readFile.readFile)({
          location: inputLocation,
          errorHandler: _helpers.isFileNotFoundError
        }).then(content => {
          const actual = (0, _helpers.createETag)(content);
          const expected = cache.inputETag;

          if (actual !== expected) {
            return "input-file-modified";
          }

          return "valid";
        }, () => Promise.resolve("input-file-missing"));
      });
    })).then(foldersStatus => {
      return foldersStatus.map((status, index) => {
        return {
          folder: folders[index],
          status
        };
      });
    });
  });
};

exports.inspect = inspect;
//# sourceMappingURL=inspect.js.map