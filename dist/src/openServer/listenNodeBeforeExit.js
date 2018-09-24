"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.listenBrowserBeforeExit = exports.listenNodeBeforeExit = exports.createListenBeforeExit = undefined;

var _signal = require("@dmail/signal");

var createListenBeforeExit = exports.createListenBeforeExit = function createListenBeforeExit(_ref) {
  var install = _ref.install,
      exit = _ref.exit;

  var beforeExitSignal = (0, _signal.createSignal)({
    emitter: _signal.asyncSimultaneousEmitter,
    installer: function installer(_ref2) {
      var emit = _ref2.emit,
          disableWhileCalling = _ref2.disableWhileCalling;

      var triggerBeforeExit = function triggerBeforeExit() {
        return emit().then(function () {
          return disableWhileCalling(exit);
        });
      };

      return install(triggerBeforeExit);
    }
  });

  return beforeExitSignal.listen;
}; // we should handle SIGTERM as well or is it handled by beforeExit?
// look at terminus module on github

var listenNodeBeforeExit = exports.listenNodeBeforeExit = createListenBeforeExit({
  install: function install(callback) {
    process.on("SIGINT", callback);
    process.on("beforeExit", callback);

    return function () {
      process.removeListener("SIGINT", callback);
      process.removeListener("beforeExit", callback);
    };
  },
  exit: function exit() {
    process.exit();
  }
});

var listenBrowserBeforeExit = exports.listenBrowserBeforeExit = createListenBeforeExit({
  install: function install(callback) {
    var _window = window,
        onbeforeunload = _window.onbeforeunload;

    window.onbeforeunload = callback;

    return function () {
      window.onbeforeunload = onbeforeunload;
    };
  },
  exit: function exit() {
    // in the browser this may not be called
    // because you cannot prevent user from leaving your page
  }
});

// const exit = env.platformPolymorph({
//       browser() {
//
//       },
//       node() {
//           process.exit();
//       }
//   });
//   const install = env.platformPolymorph({
//
//       node(callback) {
//
//       }
//   });
//   const listeners = [];
//   let uninstaller = null;
//   let installed = false;

// })());
//# sourceMappingURL=listenNodeBeforeExit.js.map