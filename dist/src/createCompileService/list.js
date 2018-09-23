"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.list = undefined;

var _cache = require("./cache.js");

var _helpers = require("./helpers.js");

var list = exports.list = function list(_ref) {
  var rootLocation = _ref.rootLocation,
      cacheFolderRelativeLocation = _ref.cacheFolderRelativeLocation;

  var cacheFolderLocation = (0, _helpers.resolvePath)(rootLocation, cacheFolderRelativeLocation);

  var visit = function visit(folderRelativeLocation) {
    var folders = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    var folderLocation = (0, _helpers.resolvePath)(cacheFolderLocation, folderRelativeLocation);

    return (0, _helpers.readFolder)(folderLocation).then(function (names) {
      if (names.includes(_cache.JSON_FILE)) {
        folders.push(folderRelativeLocation);
        return;
      }
      return Promise.all(names.map(function (name) {
        return visit((0, _helpers.resolvePath)(folderLocation, name), folders);
      }));
    }).then(function () {
      return folders;
    });
  };

  return visit(cacheFolderLocation);
};
//# sourceMappingURL=list.js.map