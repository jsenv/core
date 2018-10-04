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
const openNodeClient = ({
  compileURL,
  remoteRoot,
  localRoot,
  detached = false
}) => {
  if (detached === false) {
    const execute = ({
      file,
      collectCoverage = false,
      executeTest = false
    }) => {
      const close = () => {};

      const promise = Promise.resolve().then(() => {
        const remoteFile = (0, _getRemoteLocation.getRemoteLocation)({
          compileURL,
          file
        });
        const {
          setup,
          teardown
        } = (0, _getClientSetupAndTeardown.getNodeSetupAndTeardowm)({
          collectCoverage,
          executeTest
        });
        Promise.resolve(remoteFile).then(setup).then(() => {
          return (0, _ensureSystem.ensureSystem)({
            remoteRoot,
            localRoot
          }).import(remoteFile).then(teardown);
        });
      });
      return Promise.resolve({
        promise,
        close
      });
    };

    return Promise.resolve({
      execute
    });
  }

  const clientFile = _path.default.resolve(__dirname, "./client.js");

  let previousID = 0;

  const execute = ({
    file,
    autoClose = false,
    autoCloseOnError = false,
    executeTest = false,
    collectCoverage = false
  }) => {
    const closed = (0, _signal.createSignal)();

    const close = () => {
      closed.emit();
    };

    const promise = new Promise((resolve, reject) => {
      const id = previousID + 1;
      previousID = id;
      const child = (0, _child_process.fork)(clientFile, {
        execArgv: [// allow vscode to debug else you got port already used
        `--inspect-brk`]
      });
      const kill = closed.listen(() => {
        child.kill();
      });
      child.on("close", code => {
        kill.remove();

        if (code === 12) {
          throw new Error(`child exited with 12: forked child wanted to use a non available port for debug`);
        }

        if (code !== 0) {
          reject(`exited with code ${code}`);
        }
      });

      const onmessage = message => {
        if (message.id !== id) {
          return;
        }

        const {
          type,
          data
        } = message;

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
      const remoteFile = (0, _getRemoteLocation.getRemoteLocation)({
        compileURL,
        file
      });
      const {
        setup,
        teardown
      } = (0, _getClientSetupAndTeardown.getNodeSetupAndTeardowm)({
        collectCoverage,
        executeTest
      });
      child.send({
        type: "execute",
        id,
        data: {
          remoteRoot,
          localRoot,
          file: remoteFile,
          setupSource: `(${setup.toString()})`,
          teardownSource: `(${teardown.toString()})`
        }
      });
    }).then(value => {
      if (autoClose) {
        close();
      }

      return value;
    }, reason => {
      if (autoCloseOnError) {
        close();
      }

      return Promise.reject(reason);
    });
    return Promise.resolve({
      promise,
      close
    });
  };

  return Promise.resolve({
    execute
  });
};

exports.openNodeClient = openNodeClient;
//# sourceMappingURL=openNodeClient.js.map