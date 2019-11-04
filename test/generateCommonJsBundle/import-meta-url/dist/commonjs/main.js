'use strict';

// eslint-disable-next-line import/no-unresolved
var nodeRequire = require;
var filenameContainsBackSlashes = __filename.indexOf("\\") > -1;
var url = filenameContainsBackSlashes ? "file://".concat(__filename.replace(/\\/g, "/")) : "file://".concat(__filename);

module.exports = url;
//# sourceMappingURL=main.js.map
