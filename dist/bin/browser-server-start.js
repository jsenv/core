#!/usr/bin/env node
"use strict";

var _getFromProcessArguments = require("./getFromProcessArguments.js");

var _killPort = _interopRequireDefault(require("kill-port"));

var _openBrowserServer = require("../src/openBrowserServer/openBrowserServer.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const port = Number((0, _getFromProcessArguments.getFromProcessArguments)("port") || "3000");
const root = (0, _getFromProcessArguments.getFromProcessArguments)("root") || process.cwd();
(0, _killPort.default)(port).then(() => {
  (0, _openBrowserServer.openBrowserServer)({
    port,
    root
  });
});
//# sourceMappingURL=browser-server-start.js.map