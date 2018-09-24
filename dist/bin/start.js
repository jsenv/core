#!/usr/bin/env node
"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _openCompileServer = require("../src/openCompileServer/openCompileServer.js");

var _openServer = require("../src/openServer/openServer.js");

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

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

var projectRoot = _path2["default"].resolve(__dirname, "../../");
var port = Number(getFromArguments("port") || "0");
var file = getFromArguments("file") || projectRoot + "/index.js";
if (file.startsWith(projectRoot) === false) {
  throw new Error("The file to execute must be inside the project folder: " + file + " is not inside " + projectRoot);
}
var fileRelativeToProjectRoot = file.slice(projectRoot.length + 1);

Promise.all([(0, _openCompileServer.openCompileServer)({
  rootLocation: projectRoot,
  url: "http://127.0.0.1:0" // avoid https for now because certificates are self signed
}), (0, _openServer.openServer)({
  url: "http://127.0.0.1:" + port
})]).then(function (_ref) {
  var _ref2 = _slicedToArray(_ref, 2),
      compileServer = _ref2[0],
      indexServer = _ref2[1];

  console.log("compile server listening at", compileServer.url.toString());
  console.log("server for " + fileRelativeToProjectRoot + " listening at " + indexServer.url);

  var loaderSrc = compileServer.url + "node_modules/@dmail/module-loader/src/browser/index.js";
  var indexBody = "<!doctype html>\n\n  <head>\n    <title>Skeleton for chrome headless</title>\n    <meta charset=\"utf-8\" />\n    <script src=\"" + loaderSrc + "\"></script>\n    <script type=\"text/javascript\">\n      window.System = window.createBrowserLoader.createBrowserLoader()\n      window.System.import(\"" + compileServer.url + "compiled/" + fileRelativeToProjectRoot + "\")\n    </script>\n  </head>\n\n  <body>\n    <main></main>\n  </body>\n\n  </html>";

  indexServer.addRequestHandler(function () {
    return {
      status: 200,
      headers: {
        "content-type": "text/html",
        "content-length": Buffer.byteLength(indexBody),
        "cache-control": "no-store"
      },
      body: indexBody
    };
  });
});
//# sourceMappingURL=start.js.map