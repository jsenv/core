"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.list = void 0;

var _cache = require("./cache.js");

var _helpers = require("./helpers.js");

const list = ({
  rootLocation,
  cacheFolderRelativeLocation
}) => {
  const cacheFolderLocation = (0, _helpers.resolvePath)(rootLocation, cacheFolderRelativeLocation);

  const visit = (folderRelativeLocation, folders = []) => {
    const folderLocation = (0, _helpers.resolvePath)(cacheFolderLocation, folderRelativeLocation);
    return (0, _helpers.readFolder)(folderLocation).then(names => {
      if (names.includes(_cache.JSON_FILE)) {
        folders.push(folderRelativeLocation);
        return;
      }

      return Promise.all(names.map(name => visit((0, _helpers.resolvePath)(folderLocation, name), folders)));
    }).then(() => folders);
  };

  return visit(cacheFolderLocation);
};

exports.list = list;
//# sourceMappingURL=list.js.map