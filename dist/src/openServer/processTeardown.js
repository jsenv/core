"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.processTeardown = exports.exit = exports.beforeExit = exports.death = exports.terminate = exports.hangupOrDeath = void 0;

var _signal = require("@dmail/signal");

// when any of SIGUP, SIGINT, SIGTERM, beforeExit, exit is emitted
// call a given function allowed to return a promise in case the teardown is async
// it's very usefull to ensure a given server is closed when process exits
const hangupOrDeath = (0, _signal.createSignal)({
  emitter: _signal.asyncSimultaneousEmitter,
  installer: ({
    emit
  }) => {
    // SIGHUP http://man7.org/linux/man-pages/man7/signal.7.html
    const triggerHangUpOrDeath = () => emit("hangupOrDeath");

    process.on("SIGUP", triggerHangUpOrDeath);
    return () => {
      process.removeListener("SIGUP", triggerHangUpOrDeath);
    };
  }
});
exports.hangupOrDeath = hangupOrDeath;
const terminate = (0, _signal.createSignal)({
  emitter: _signal.asyncSimultaneousEmitter,
  installer: ({
    emit
  }) => {
    // SIGINT is CTRL+C from keyboard
    // http://man7.org/linux/man-pages/man7/signal.7.html
    // may also be sent by vscode https://github.com/Microsoft/vscode-node-debug/issues/1#issuecomment-405185642
    const triggerTerminate = () => emit("terminate");

    process.on("SIGINT", triggerTerminate);
    return () => {
      process.removeListener("SIGINT", triggerTerminate);
    };
  }
});
exports.terminate = terminate;
const death = (0, _signal.createSignal)({
  emitter: _signal.asyncSimultaneousEmitter,
  installer: ({
    emit
  }) => {
    // is SIGTERM handled by beforeExit ? ook at terminus module on github
    // SIGTERM http://man7.org/linux/man-pages/man7/signal.7.html
    const triggerDeath = () => emit("death");

    process.on("SIGTERM", triggerDeath);
    return () => {
      process.removeListener("SIGTERM", triggerDeath);
    };
  }
});
exports.death = death;
const beforeExit = (0, _signal.createSignal)({
  emitter: _signal.asyncSimultaneousEmitter,
  installer: ({
    emit,
    disableWhileCalling
  }) => {
    const triggerBeforeExit = () => emit("beforeExit").then(() => disableWhileCalling(() => {
      process.exit();
    }));

    process.on("beforeExit", triggerBeforeExit);
    return () => {
      process.removeListener("beforeExit", triggerBeforeExit);
    };
  }
});
exports.beforeExit = beforeExit;
const exit = (0, _signal.createSignal)({
  emitter: _signal.asyncSimultaneousEmitter,
  installer: ({
    emit
  }) => {
    const triggerExit = () => {
      emit("exit");
    };

    process.on("exit", triggerExit);
    return () => {
      process.removeListener("exit", triggerExit);
    };
  }
});
exports.exit = exit;
const signals = [hangupOrDeath, terminate, death, beforeExit, exit];

const processTeardown = teardownFunction => {
  const listeners = signals.map(signal => {
    return signal.listen(reason => {
      listeners.forEach(listener => {
        listener.remove();
      });
      return teardownFunction(reason);
    });
  });
  return () => {
    listeners.forEach(listener => {
      listener.remove();
    });
  };
}; // export const listenBrowserBeforeExit = createListenBeforeExit({
//   install: (callback) => {
//     const { onbeforeunload } = window
//     window.onbeforeunload = callback
//     return () => {
//       window.onbeforeunload = onbeforeunload
//     }
//   },
//   exit: () => {
//     // in the browser this may not be called
//     // because you cannot prevent user from leaving your page
//   },
// })


exports.processTeardown = processTeardown;
//# sourceMappingURL=processTeardown.js.map