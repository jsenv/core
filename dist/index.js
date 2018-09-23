"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createModuleRunner = exports.run = exports.openChromiumClient = exports.openCompileServer = exports.createCoverageFromTestReport = exports.testProject = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _openChromiumClient = require("./src/openChromiumClient/openChromiumClient.js");

var _openCompileServer = require("./src/openCompileServer/openCompileServer.js");

var _openNodeClient = require("./src/openNodeClient/openNodeClient.js");

var _coverFolder = require("./src/coverFolder/coverFolder.js");

var _run = require("./src/run/run.js");

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; } // https://github.com/jsenv/core/blob/master/src/api/api.js
// https://github.com/ModuleLoader/system-register-loader/blob/master/src/system-register-loader.js

// pour le coverage
// https://github.com/jsenv/core/blob/master/more/test/playground/coverage/run.js
// https://github.com/jsenv/core/blob/master/more/to-externalize/module-cover/index.js

exports.testProject = _coverFolder.testProject;
exports.createCoverageFromTestReport = _coverFolder.createCoverageFromTestReport;
exports.openCompileServer = _openCompileServer.openCompileServer;
exports.openChromiumClient = _openChromiumClient.openChromiumClient;
exports.run = _run.run;
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

      return (0, _openNodeClient.openNodeClient)({ server: server }).then(function (nodeClient) {
        // we should return a way to close?
        return nodeClient.execute(_extends({
          file: file
        }, rest));
      });
    };

    var runInsideChromium = function runInsideChromium(_ref2) {
      var file = _ref2.file,
          _ref2$headless = _ref2.headless,
          headless = _ref2$headless === undefined ? true : _ref2$headless,
          _ref2$cover = _ref2.cover,
          cover = _ref2$cover === undefined ? false : _ref2$cover;

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

    return { runInsideNode: runInsideNode, runInsideChromium: runInsideChromium };
  });
};
exports.createModuleRunner = createModuleRunner;
//# sourceMappingURL=index.js.map