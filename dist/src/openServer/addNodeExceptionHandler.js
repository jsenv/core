"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addNodeExceptionHandler = void 0;

var _signal = require("@dmail/signal");

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

var exceptionEmitter = function exceptionEmitter() {
  var resolve;
  var reject;
  var recoverManualPromise = new Promise(function (res, rej) {
    resolve = res;
    reject = rej;
  });

  var visitor = function visitor(param) {
    var recoverListenerPromise = (0, _signal.someAsyncListenerResolvesWith)(function (value) {
      return value === true;
    })(param);
    return Promise.race([recoverManualPromise, recoverListenerPromise]);
  };

  return {
    visitor: visitor,
    resolve: resolve,
    reject: reject
  };
};

var createAddExceptionHandler = function createAddExceptionHandler(_ref) {
  var install = _ref.install;
  var exceptionSignal = (0, _signal.createSignal)({
    emitter: exceptionEmitter,
    recursed: function recursed(_ref2) {
      var emitExecution = _ref2.emitExecution,
          args = _ref2.args;
      console.error("".concat(args[0].value, " error occured while handling ").concat(emitExecution.args[0]));
      emitExecution.resolve(false);
    },
    installer: function installer(_ref3) {
      var isEmitting = _ref3.isEmitting,
          getEmitExecution = _ref3.getEmitExecution,
          emit = _ref3.emit,
          disableWhileCalling = _ref3.disableWhileCalling;

      var triggerException = function triggerException(exception) {
        emit(exception).then(function (recovered) {
          if (recovered) {
            return;
          } // removeAllWhileCalling prevent catching of the next throw
          // else the following would create an infinite loop
          // process.on('uncaughtException', function() {
          //     setTimeout(function() {
          //         throw 'yo';
          //     });
          // });


          disableWhileCalling(function () {
            throw exception.value; // this mess up the stack trace :'(
          });
        }, function (otherException) {
          console.error("".concat(otherException, " internal error occured while handling ").concat(exception));
          disableWhileCalling(function () {
            throw exception.value;
          });
        });
      };

      var recoverWhen = function recoverWhen(match) {
        if (isEmitting()) {
          var emitExecution = getEmitExecution();

          if (match.apply(void 0, _toConsumableArray(emitExecution.getArguments()))) {
            emitExecution.resolve(true);
          }
        }
      };

      return install({
        triggerException: triggerException,
        recoverWhen: recoverWhen
      });
    }
  });
  return exceptionSignal.listen;
};

var addNodeExceptionHandler = createAddExceptionHandler({
  install: function install(_ref4) {
    var triggerException = _ref4.triggerException,
        recoverWhen = _ref4.recoverWhen;

    var onError = function onError(error) {
      triggerException({
        value: error
      });
    };

    var onUnhandledRejection = function onUnhandledRejection(value, promise) {
      triggerException({
        value: value,
        origin: promise
      });
    };

    var onRejectionHandled = function onRejectionHandled(promise) {
      recoverWhen(function (_ref5) {
        var origin = _ref5.origin;
        return origin === promise;
      });
    };

    process.on("unhandledRejection", onUnhandledRejection);
    process.on("rejectionHandled", onRejectionHandled);
    process.on("uncaughtException", onError);
    return function () {
      process.removeListener("unhandledRejection", onUnhandledRejection);
      process.removeListener("rejectionHandled", onRejectionHandled);
      process.removeListener("uncaughtException", onError);
    };
  }
});
exports.addNodeExceptionHandler = addNodeExceptionHandler;
//# sourceMappingURL=addNodeExceptionHandler.js.map