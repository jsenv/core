"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = void 0;

var _openCompileServer = require("../openCompileServer/openCompileServer.js");

var _openNodeClient = require("../openNodeClient/openNodeClient.js");

var _openChromiumClient = require("../openChromiumClient/openChromiumClient.js");

var run = function run(_ref) {
  var _ref$root = _ref.root,
      root = _ref$root === void 0 ? process.cwd() : _ref$root,
      file = _ref.file,
      _ref$port = _ref.port,
      port = _ref$port === void 0 ? 0 : _ref$port,
      _ref$platform = _ref.platform,
      platform = _ref$platform === void 0 ? "node" : _ref$platform,
      _ref$headless = _ref.headless,
      headless = _ref$headless === void 0 ? false : _ref$headless,
      _ref$watch = _ref.watch,
      watch = _ref$watch === void 0 ? false : _ref$watch,
      _ref$instrument = _ref.instrument,
      instrument = _ref$instrument === void 0 ? false : _ref$instrument;
  var relativeFile = file;

  var openServer = function openServer() {
    return (0, _openCompileServer.openCompileServer)({
      rootLocation: root,
      abstractFolderRelativeLocation: "compiled",
      url: "http://127.0.0.1:0".concat(port),
      // avoid https for now because certificates are self signed
      instrument: instrument,
      watch: watch
    });
  };

  var createClient = function createClient(server) {
    if (platform === "node") {
      return (0, _openNodeClient.openNodeClient)({
        compileURL: server.compileURL,
        localRoot: root,
        detached: true // remoteRoot: "http://127.0.0.1:3001",

      });
    }

    if (platform === "chromium") {
      return (0, _openChromiumClient.openChromiumClient)({
        url: "http://127.0.0.1:0".concat(port),
        // force http for now
        server: server,
        compileURL: server.compileURL,
        headless: headless,
        mirrorConsole: true
      });
    }
  };

  return openServer().then(function (server) {
    console.log("server listening at ".concat(server.url));
    return createClient(server).then(function (client) {
      return client.execute({
        file: relativeFile,
        collectCoverage: instrument
      });
    }).then(function () {
      if (watch === false) {// server.close()
      }
    });
  });
};

exports.run = run;
//# sourceMappingURL=run.js.map