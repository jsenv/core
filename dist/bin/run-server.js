#!/usr/bin/env node
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.open = undefined;

var _openCompileServer = require("../src/openCompileServer/openCompileServer.js");

var _openServer = require("../src/openServer/openServer.js");

var _createHTMLForBrowser = require("../src/createHTMLForBrowser.js");

var openRunServer = function openRunServer(_ref) {
  var compileURL = _ref.compileURL,
      url = _ref.url;

  return (0, _openServer.openServer)({ url: url }).then(function (runServer) {
    runServer.addRequestHandler(function (request) {
      var fileRelativeToRoot = request.url.pathname.slice(1);

      return (0, _createHTMLForBrowser.createHTMLForBrowser)({
        script: "window.System.import(\"" + compileURL + "/" + fileRelativeToRoot + "\")"
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

    return runServer;
  });
};

var open = exports.open = function open(_ref2) {
  var root = _ref2.root,
      url = _ref2.url,
      compiledFolder = _ref2.compiledFolder;

  return (0, _openCompileServer.openCompileServer)({
    rootLocation: root,
    compiledFolderRelativeLocation: compiledFolder,
    url: "http://127.0.0.1:3001" // avoid https for now because certificates are self signed
  }).then(function (compileServer) {
    var compileURL = "" + compileServer.url + compileServer.abstractFolderRelativeLocation;

    return openRunServer({
      compileURL: compileURL,
      url: url
    }).then(function (runServer) {
      return {
        compileURL: compileURL,
        runURL: runServer.url
      };
    });
  });
};
//# sourceMappingURL=run-server.js.map