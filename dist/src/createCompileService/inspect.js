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

var inspect = function inspect(_ref) {
  var rootLocation = _ref.rootLocation,
      cacheFolderRelativeLocation = _ref.cacheFolderRelativeLocation;
  var cacheFolderLocation = (0, _helpers.resolvePath)(rootLocation, cacheFolderRelativeLocation);
  return (0, _list.list)({
    rootLocation: rootLocation,
    cacheFolderRelativeLocation: cacheFolderRelativeLocation
  }).then(function (folders) {
    return Promise.all(folders.map(function (folder) {
      return (0, _readFile.readFile)({
        location: (0, _helpers.resolvePath)(cacheFolderLocation, folder, _cache.JSON_FILE)
      }).then(JSON.parse).then(function (cache) {
        var inputLocation = (0, _locateFile.locateFile)(cache.inputRelativeLocation, rootLocation);
        return (0, _readFile.readFile)({
          location: inputLocation,
          errorHandler: _helpers.isFileNotFoundError
        }).then(function (content) {
          var actual = (0, _helpers.createETag)(content);
          var expected = cache.inputETag;

          if (actual !== expected) {
            return "input-file-modified";
          }

          return "valid";
        }, function () {
          return Promise.resolve("input-file-missing");
        });
      });
    })).then(function (foldersStatus) {
      return foldersStatus.map(function (status, index) {
        return {
          folder: folders[index],
          status: status
        };
      });
    });
  });
};

exports.inspect = inspect;
//# sourceMappingURL=inspect.js.map