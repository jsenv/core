#!/usr/bin/env node
"use strict";

var _openNodeClient = require("../src/openNodeClient/openNodeClient.js");

var _getFromProcessArguments = require("./getFromProcessArguments.js");

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// additional ../ to get rid of dist
var rootLocation = _path2["default"].resolve(__dirname, "../../");

var file = (0, _getFromProcessArguments.getFromProcessArguments)("file");

(0, _openNodeClient.openNodeClient)({
  localRoot: rootLocation,
  // remoteRoot: "http://127.0.0.1:3001",
  compileURL: "http://127.0.0.1:3001/compiled",
  detached: false
}).then(function (_ref) {
  var execute = _ref.execute;

  execute({ file: file });
});
//# sourceMappingURL=run-node.js.map