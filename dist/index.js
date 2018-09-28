"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "openChromiumClient", {
  enumerable: true,
  get: function get() {
    return _openChromiumClient.openChromiumClient;
  }
});
Object.defineProperty(exports, "openCompileServer", {
  enumerable: true,
  get: function get() {
    return _openCompileServer.openCompileServer;
  }
});
Object.defineProperty(exports, "openBrowserServer", {
  enumerable: true,
  get: function get() {
    return _openBrowserServer.openBrowserServer;
  }
});
Object.defineProperty(exports, "testProject", {
  enumerable: true,
  get: function get() {
    return _coverFolder.testProject;
  }
});
Object.defineProperty(exports, "createCoverageFromTestReport", {
  enumerable: true,
  get: function get() {
    return _coverFolder.createCoverageFromTestReport;
  }
});
Object.defineProperty(exports, "run", {
  enumerable: true,
  get: function get() {
    return _run.run;
  }
});
exports.createModuleRunner = void 0;

var _openChromiumClient = require("./src/openChromiumClient/openChromiumClient.js");

var _openCompileServer = require("./src/openCompileServer/openCompileServer.js");

var _openNodeClient = require("./src/openNodeClient/openNodeClient.js");

var _openBrowserServer = require("./src/openBrowserServer/openBrowserServer.js");

var _coverFolder = require("./src/coverFolder/coverFolder.js");

var _run = require("./src/run/run.js");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

var createModuleRunner = function createModuleRunner(params) {
  // if there is already a compileServer running for that location
  // they will work as long as the code which created them run in the same terminal
  // if two terminal spawns a server trying to compile a given project they will concurrently
  // read/write filesystem.
  // To fix that we could:
  // - update createLock.js so that, somehow, it can lock calls from different terminals
  // - save somewhere the port used for that specific project and reuse when existing
  // save used port is the easiest solution but we'll ignore this issue for now
  // and assume noone will try to open two server for the same location
  return (0, _openCompileServer.openCompileServer)(params).then(function (server) {
    var runInsideNode = function runInsideNode(_ref) {
      var file = _ref.file,
          rest = _objectWithoutProperties(_ref, ["file"]);

      return (0, _openNodeClient.openNodeClient)({
        server: server
      }).then(function (nodeClient) {
        // we should return a way to close?
        return nodeClient.execute(_objectSpread({
          file: file
        }, rest));
      });
    };

    var runInsideChromium = function runInsideChromium(_ref2) {
      var file = _ref2.file,
          _ref2$headless = _ref2.headless,
          headless = _ref2$headless === void 0 ? true : _ref2$headless,
          _ref2$cover = _ref2.cover,
          cover = _ref2$cover === void 0 ? false : _ref2$cover;
      return (0, _openChromiumClient.openChromiumClient)({
        compileURL: server.compileURL,
        headless: headless
      }).then(function (chromiumClient) {
        return chromiumClient.execute({
          file: file,
          collectCoverage: cover
        }).then(function (_ref3) {
          var promise = _ref3.promise;
          return promise;
        });
      });
    };

    return {
      runInsideNode: runInsideNode,
      runInsideChromium: runInsideChromium
    };
  });
};

exports.createModuleRunner = createModuleRunner;
//# sourceMappingURL=index.js.map