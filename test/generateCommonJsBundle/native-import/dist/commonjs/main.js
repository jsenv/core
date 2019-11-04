'use strict';

var fs = require('fs');

var nativeImport = typeof fs.readFile === "function" ? 42 : 40;

module.exports = nativeImport;
//# sourceMappingURL=main.js.map
