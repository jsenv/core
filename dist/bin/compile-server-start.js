#!/usr/bin/env node
"use strict";

var _openCompileServer = require("../src/openCompileServer/openCompileServer.js");

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _killPort = require("kill-port");

var _killPort2 = _interopRequireDefault(_killPort);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var getFromArguments = function getFromArguments(name) {
  var foundRawArg = process.argv.find(function (arg) {
    return arg.startsWith("--" + name + "=");
  });
  if (!foundRawArg) {
    return;
  }
  return foundRawArg.slice(("--" + name + "=").length);
};

var root = getFromArguments("root") || _path2["default"].resolve(__dirname, "../../");
var port = Number(getFromArguments("port") || "3001");
var folder = getFromArguments("folder") || "compiled";

var open = function open() {
  return (0, _openCompileServer.openCompileServer)({
    rootLocation: root,
    abstractFolderRelativeLocation: folder,
    url: "http://127.0.0.1:" + port // avoid https for now because certificates are self signed
  }).then(function (compileServer) {
    console.log("compile server listening at " + compileServer.url);
  });
};

(0, _killPort2["default"])(port).then(open);
//# sourceMappingURL=compile-server-start.js.map