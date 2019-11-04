'use strict';

// eslint-disable-next-line import/no-unresolved
var nodeRequire = require;
var filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
var url = filenameContainsBackSlashes ? "file://".concat(__filename.replace(/\\/g, "/")) : "file://".concat(__filename);

var _require2 = nodeRequire("fs"),
    readFile = _require2.readFile;

var importMetaRequire = typeof readFile === "function" ? 42 : 40;

module.exports = importMetaRequire;
//# sourceMappingURL=main.js.map
