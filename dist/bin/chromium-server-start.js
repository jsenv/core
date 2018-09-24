#!/usr/bin/env node
"use strict";

var _openServer = require("../src/openServer/openServer.js");

var _createHTMLForBrowser = require("../src/createHTMLForBrowser.js");

var getFromArguments = function getFromArguments(name) {
  var foundRawArg = process.argv.find(function (arg) {
    return arg.startsWith("--" + name + "=");
  });
  if (!foundRawArg) {
    return;
  }
  return foundRawArg.slice(("--" + name + "=").length);
};

var compileURL = getFromArguments("compile-url") || "http://127.0.0.1:3001/compiled";
var port = Number(getFromArguments("port") || "3000");

var getClientScript = function getClientScript(_ref) {
  var compileURL = _ref.compileURL,
      url = _ref.url;

  var fileRelativeToRoot = url.pathname.slice(1);

  return "window.System.import(\"" + compileURL + "/" + fileRelativeToRoot + "\")\nif(\"__test__\" in window) {\n\twindow.__test__()\n}";
};

(0, _openServer.openServer)({ url: "http://127.0.0.1:" + port }).then(function (runServer) {
  runServer.addRequestHandler(function (request) {
    return (0, _createHTMLForBrowser.createHTMLForBrowser)({
      script: getClientScript({ compileURL: compileURL, url: request.url })
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
//# sourceMappingURL=chromium-server-start.js.map