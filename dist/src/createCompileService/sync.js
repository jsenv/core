"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sync = undefined;

var _helpers = require("./helpers.js");

var _inspect = require("./inspect.js");

var sync = exports.sync = function sync(_ref) {
  var rootLocation = _ref.rootLocation,
      cacheFolderRelativeLocation = _ref.cacheFolderRelativeLocation;

  var cacheFolderLocation = (0, _helpers.resolvePath)(rootLocation, cacheFolderRelativeLocation);

  return (0, _inspect.inspect)({ rootLocation: rootLocation, cacheFolderRelativeLocation: cacheFolderRelativeLocation }).then(function (report) {
    var foldersInvalid = report.filter(function (_ref2) {
      var status = _ref2.status;
      return status !== "valid";
    });

    return Promise.all(foldersInvalid.map(function (_ref3) {
      var folder = _ref3.folder;
      return (0, _helpers.removeFolderDeep)((0, _helpers.resolvePath)(cacheFolderLocation, folder));
    }));
  });
};
//# sourceMappingURL=sync.js.map