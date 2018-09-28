"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openNodeClient = void 0;

var _child_process = require("child_process");

var _path = _interopRequireDefault(require("path"));

var _ensureSystem = require("./ensureSystem.js");

require("./global-fetch.js");

var _getRemoteLocation = require("../getRemoteLocation.js");

var _getClientSetupAndTeardown = require("../getClientSetupAndTeardown.js");

var _signal = require("@dmail/signal");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// faut vraiment que je teste ça avec https://github.com/GoogleChromeLabs/ndb
// en gros voir si ndb va fonctionner
// pour debug l'éxécution de nodejs avec chrome devtools
// en utilisant system.import
var openNodeClient = function openNodeClient(_ref) {
  var compileURL = _ref.compileURL,
      remoteRoot = _ref.remoteRoot,
      localRoot = _ref.localRoot,
      _ref$detached = _ref.detached,
      detached = _ref$detached === void 0 ? false : _ref$detached;

  if (detached === false) {
    var _execute = function _execute(_ref2) {
      var file = _ref2.file,
          _ref2$collectCoverage = _ref2.collectCoverage,
          collectCoverage = _ref2$collectCoverage === void 0 ? false : _ref2$collectCoverage,
          _ref2$executeTest = _ref2.executeTest,
          executeTest = _ref2$executeTest === void 0 ? false : _ref2$executeTest;

      var close = function close() {};

      var promise = Promise.resolve().then(function () {
        var remoteFile = (0, _getRemoteLocation.getRemoteLocation)({
          compileURL: compileURL,
          file: file
        });

        var _getNodeSetupAndTeard = (0, _getClientSetupAndTeardown.getNodeSetupAndTeardowm)({
          collectCoverage: collectCoverage,
          executeTest: executeTest
        }),
            setup = _getNodeSetupAndTeard.setup,
            teardown = _getNodeSetupAndTeard.teardown;

        Promise.resolve(remoteFile).then(setup).then(function () {
          return (0, _ensureSystem.ensureSystem)({
            remoteRoot: remoteRoot,
            localRoot: localRoot
          }).import(remoteFile).then(teardown);
        });
      });
      return Promise.resolve({
        promise: promise,
        close: close
      });
    };

    return Promise.resolve({
      execute: _execute
    });
  }

  var clientFile = _path.default.resolve(__dirname, "./client.js");

  var previousID = 0;

  var execute = function execute(_ref3) {
    var file = _ref3.file,
        _ref3$autoClose = _ref3.autoClose,
        autoClose = _ref3$autoClose === void 0 ? false : _ref3$autoClose,
        _ref3$autoCloseOnErro = _ref3.autoCloseOnError,
        autoCloseOnError = _ref3$autoCloseOnErro === void 0 ? false : _ref3$autoCloseOnErro,
        _ref3$executeTest = _ref3.executeTest,
        executeTest = _ref3$executeTest === void 0 ? false : _ref3$executeTest,
        _ref3$collectCoverage = _ref3.collectCoverage,
        collectCoverage = _ref3$collectCoverage === void 0 ? false : _ref3$collectCoverage;
    var closed = (0, _signal.createSignal)();

    var close = function close() {
      closed.emit();
    };

    var promise = new Promise(function (resolve, reject) {
      var id = previousID + 1;
      previousID = id;
      var child = (0, _child_process.fork)(clientFile, {
        execArgv: [// allow vscode to debug else you got port already used
        "--inspect-brk"]
      });
      var kill = closed.listen(function () {
        child.kill();
      });
      child.on("close", function (code) {
        kill.remove();

        if (code === 12) {
          throw new Error("child exited with 12: forked child wanted to use a non available port for debug");
        }

        if (code !== 0) {
          reject("exited with code ".concat(code));
        }
      });

      var onmessage = function onmessage(message) {
        if (message.id !== id) {
          return;
        }

        var type = message.type,
            data = message.data;

        if (type === "execute-result") {
          child.removeListener("message", onmessage);

          if (data.code === 0) {
            resolve(data.value);
          } else {
            console.log("rejecting");
            reject(data.value);
          }
        }
      };

      child.on("message", onmessage);
      var remoteFile = (0, _getRemoteLocation.getRemoteLocation)({
        compileURL: compileURL,
        file: file
      });

      var _getNodeSetupAndTeard2 = (0, _getClientSetupAndTeardown.getNodeSetupAndTeardowm)({
        collectCoverage: collectCoverage,
        executeTest: executeTest
      }),
          setup = _getNodeSetupAndTeard2.setup,
          teardown = _getNodeSetupAndTeard2.teardown;

      child.send({
        type: "execute",
        id: id,
        data: {
          remoteRoot: remoteRoot,
          localRoot: localRoot,
          file: remoteFile,
          setupSource: "(".concat(setup.toString(), ")"),
          teardownSource: "(".concat(teardown.toString(), ")")
        }
      });
    }).then(function (value) {
      if (autoClose) {
        close();
      }

      return value;
    }, function (reason) {
      if (autoCloseOnError) {
        close();
      }

      return Promise.reject(reason);
    });
    return Promise.resolve({
      promise: promise,
      close: close
    });
  };

  return Promise.resolve({
    execute: execute
  });
};

exports.openNodeClient = openNodeClient;
//# sourceMappingURL=openNodeClient.js.map