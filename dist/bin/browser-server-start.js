#!/usr/bin/env node
"use strict";

var _getFromProcessArguments = require("./getFromProcessArguments.js");

var _killPort = _interopRequireDefault(require("kill-port"));

var _openBrowserServer = require("../src/openBrowserServer/openBrowserServer.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var port = Number((0, _getFromProcessArguments.getFromProcessArguments)("port") || "3000");
var root = (0, _getFromProcessArguments.getFromProcessArguments)("root") || process.cwd();
(0, _killPort.default)(port).then(function () {
  (0, _openBrowserServer.openBrowserServer)({
    port: port,
    root: root
  });
});
//# sourceMappingURL=browser-server-start.js.map