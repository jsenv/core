"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.sync = void 0;

var _helpers = require("./helpers.js");

var _inspect = require("./inspect.js");

const sync = ({
  rootLocation,
  cacheFolderRelativeLocation
}) => {
  const cacheFolderLocation = (0, _helpers.resolvePath)(rootLocation, cacheFolderRelativeLocation);
  return (0, _inspect.inspect)({
    rootLocation,
    cacheFolderRelativeLocation
  }).then(report => {
    const foldersInvalid = report.filter(({
      status
    }) => status !== "valid");
    return Promise.all(foldersInvalid.map(({
      folder
    }) => (0, _helpers.removeFolderDeep)((0, _helpers.resolvePath)(cacheFolderLocation, folder))));
  });
};

exports.sync = sync;
//# sourceMappingURL=sync.js.map