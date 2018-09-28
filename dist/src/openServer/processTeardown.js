"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.processTeardown = exports.exit = exports.beforeExit = exports.death = exports.terminate = exports.hangupOrDeath = void 0;

var _signal = require("@dmail/signal");

// when any of SIGUP, SIGINT, SIGTERM, beforeExit, exit is emitted
// call a given function allowed to return a promise in case the teardown is async
// it's very usefull to ensure a given server is closed when process exits
var hangupOrDeath = (0, _signal.createSignal)({
  emitter: _signal.asyncSimultaneousEmitter,
  installer: function installer(_ref) {
    var emit = _ref.emit;

    // SIGHUP http://man7.org/linux/man-pages/man7/signal.7.html
    var triggerHangUpOrDeath = function triggerHangUpOrDeath() {
      return emit("hangupOrDeath");
    };

    process.on("SIGUP", triggerHangUpOrDeath);
    return function () {
      process.removeListener("SIGUP", triggerHangUpOrDeath);
    };
  }
});
exports.hangupOrDeath = hangupOrDeath;
var terminate = (0, _signal.createSignal)({
  emitter: _signal.asyncSimultaneousEmitter,
  installer: function installer(_ref2) {
    var emit = _ref2.emit;

    // SIGINT is CTRL+C from keyboard
    // http://man7.org/linux/man-pages/man7/signal.7.html
    // may also be sent by vscode https://github.com/Microsoft/vscode-node-debug/issues/1#issuecomment-405185642
    var triggerTerminate = function triggerTerminate() {
      return emit("terminate");
    };

    process.on("SIGINT", triggerTerminate);
    return function () {
      process.removeListener("SIGINT", triggerTerminate);
    };
  }
});
exports.terminate = terminate;
var death = (0, _signal.createSignal)({
  emitter: _signal.asyncSimultaneousEmitter,
  installer: function installer(_ref3) {
    var emit = _ref3.emit;

    // is SIGTERM handled by beforeExit ? ook at terminus module on github
    // SIGTERM http://man7.org/linux/man-pages/man7/signal.7.html
    var triggerDeath = function triggerDeath() {
      return emit("death");
    };

    process.on("SIGTERM", triggerDeath);
    return function () {
      process.removeListener("SIGTERM", triggerDeath);
    };
  }
});
exports.death = death;
var beforeExit = (0, _signal.createSignal)({
  emitter: _signal.asyncSimultaneousEmitter,
  installer: function installer(_ref4) {
    var emit = _ref4.emit,
        disableWhileCalling = _ref4.disableWhileCalling;

    var triggerBeforeExit = function triggerBeforeExit() {
      return emit("beforeExit").then(function () {
        return disableWhileCalling(function () {
          process.exit();
        });
      });
    };

    process.on("beforeExit", triggerBeforeExit);
    return function () {
      process.removeListener("beforeExit", triggerBeforeExit);
    };
  }
});
exports.beforeExit = beforeExit;
var exit = (0, _signal.createSignal)({
  emitter: _signal.asyncSimultaneousEmitter,
  installer: function installer(_ref5) {
    var emit = _ref5.emit;

    var triggerExit = function triggerExit() {
      emit("exit");
    };

    process.on("exit", triggerExit);
    return function () {
      process.removeListener("exit", triggerExit);
    };
  }
});
exports.exit = exit;
var signals = [hangupOrDeath, terminate, death, beforeExit, exit];

var processTeardown = function processTeardown(teardownFunction) {
  var listeners = signals.map(function (signal) {
    return signal.listen(function (reason) {
      listeners.forEach(function (listener) {
        listener.remove();
      });
      return teardownFunction(reason);
    });
  });
  return function () {
    listeners.forEach(function (listener) {
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