"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openBrowserServer = undefined;

var _openCompileServer = require("../openCompileServer/openCompileServer.js");

var _openServer = require("../openServer/openServer.js");

var _createHTMLForBrowser = require("../createHTMLForBrowser.js");

var getClientScript = function getClientScript(_ref) {
  var compileURL = _ref.compileURL,
      url = _ref.url;

  var fileRelativeToRoot = url.pathname.slice(1);

  return "window.System.import(\"" + compileURL + "/" + fileRelativeToRoot + "\")";
};

var openBrowserServer = exports.openBrowserServer = function openBrowserServer(_ref2) {
  var root = _ref2.root,
      _ref2$port = _ref2.port,
      port = _ref2$port === undefined ? 0 : _ref2$port;

  return (0, _openCompileServer.openCompileServer)({
    url: "http://127.0.0.1:0",
    rootLocation: root
  }).then(function (server) {
    console.log("compiling " + root + " at " + server.url);
    return (0, _openServer.openServer)({ url: "http://127.0.0.1:" + port }).then(function (runServer) {
      runServer.addRequestHandler(function (request) {
        if (request.url.pathname === "/") {
          // on voudrait ptet servir du html
          // pour expliquer comment run les fichier etc
        }

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

      console.log("executing " + root + " at " + runServer.url);

      return runServer;
    });
  });
};
//# sourceMappingURL=openBrowserServer.js.map