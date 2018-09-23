#!/usr/bin/env node
"use strict";

var _getFromProcessArguments = require("./getFromProcessArguments.js");

var _openCompileServer = require("../src/openCompileServer/openCompileServer.js");

var _openServer = require("../src/openServer/openServer.js");

var _createHTMLForBrowser = require("../src/createHTMLForBrowser.js");

var _killPort = require("kill-port");

var _killPort2 = _interopRequireDefault(_killPort);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var port = Number((0, _getFromProcessArguments.getFromProcessArguments)("port") || "3000");
var root = (0, _getFromProcessArguments.getFromProcessArguments)("root") || process.cwd();

var getClientScript = function getClientScript(_ref) {
  var compileURL = _ref.compileURL,
      url = _ref.url;

  var fileRelativeToRoot = url.pathname.slice(1);

  return "window.System.import(\"" + compileURL + "/" + fileRelativeToRoot + "\")";
};

var open = function open() {
  (0, _openCompileServer.openCompileServer)({
    url: "http://127.0.0.1:0",
    rootLocation: root
  }).then(function (server) {
    (0, _openServer.openServer)({ url: "http://127.0.0.1:" + port }).then(function (runServer) {
      runServer.addRequestHandler(function (request) {
        return (0, _createHTMLForBrowser.createHTMLForBrowser)({
          script: getClientScript({ compileURL: server.compileURL, url: request.url })
        }).then(function (html) {
          return {
            status: 200,
            headers: {
              "content-type": "text/html",
              "content-length": Buffer.byteLength(html),
              "cache-control": "no-store"
            },
            body: html
          };
        });
      });

      console.log("chromium server listening at " + runServer.url);
    });
  });
};

(0, _killPort2["default"])(port).then(open);
//# sourceMappingURL=chromium-vscode-server-start.js.map