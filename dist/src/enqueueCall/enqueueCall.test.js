"use strict";

var _test = require("@dmail/test");

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _micmac = require("micmac");

var _promise = require("../promise.js");

var _enqueueCall = require("./enqueueCall.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var assertPromiseIsPending = function assertPromiseIsPending(promise) {
  (0, _assert2["default"])(promise.status === "pending" || promise.status === "resolved");
};

var assertPromiseIsFulfilled = function assertPromiseIsFulfilled(promise) {
  _assert2["default"].equal(promise.status, "fulfilled");
};

var assertPromiseIsRejected = function assertPromiseIsRejected(promise) {
  _assert2["default"].equal(promise.status, "rejected");
};

var assertPromiseIsFulfilledWith = function assertPromiseIsFulfilledWith(promise, value) {
  assertPromiseIsFulfilled(promise);
  _assert2["default"].equal(promise.value, value);
};

var assertPromiseIsRejectedWith = function assertPromiseIsRejectedWith(promise, value) {
  assertPromiseIsRejected(promise);
  _assert2["default"].equal(promise.value, value);
};

(0, _test.test)(function () {
  (0, _micmac.mockExecution)(function (_ref) {
    var tick = _ref.tick;

    var fn = function fn(value) {
      return value;
    };

    var _createPromiseAndHook = (0, _promise.createPromiseAndHooks)(),
        promise = _createPromiseAndHook.promise,
        resolve = _createPromiseAndHook.resolve;

    var returnedPromise = (0, _enqueueCall.enqueueCall)(fn)(promise);

    assertPromiseIsPending(returnedPromise);
    resolve(1);
    tick();
    assertPromiseIsFulfilledWith(returnedPromise, 1);
  });
});

(0, _test.test)(function () {
  (0, _micmac.mockExecution)(function (_ref2) {
    var tick = _ref2.tick;

    var fn = function fn(value) {
      return value;
    };

    var _createPromiseAndHook2 = (0, _promise.createPromiseAndHooks)(),
        promise = _createPromiseAndHook2.promise,
        reject = _createPromiseAndHook2.reject;

    var returnedPromise = (0, _enqueueCall.enqueueCall)(fn)(promise);

    assertPromiseIsPending(returnedPromise);
    reject(1);
    tick();
    assertPromiseIsRejectedWith(returnedPromise, 1);
  });
});

// un appel attends la résolution de tout autre appel en cours
(0, _test.test)(function () {
  (0, _micmac.mockExecution)(function (_ref3) {
    var tick = _ref3.tick;

    var debounced = (0, _enqueueCall.enqueueCall)(function (promise, value) {
      return promise.then(function () {
        return value;
      });
    });
    var firstPromise = (0, _promise.createPromiseAndHooks)();
    var firstCallPromise = debounced(firstPromise.promise, 1);
    var secondPromise = (0, _promise.createPromiseAndHooks)();
    var secondCallPromise = debounced(secondPromise.promise, 2);

    assertPromiseIsPending(firstCallPromise);
    assertPromiseIsPending(secondCallPromise);
    firstPromise.resolve();
    tick();
    assertPromiseIsFulfilledWith(firstCallPromise, 1);
    assertPromiseIsPending(secondCallPromise);
    secondPromise.resolve();
    tick();
    assertPromiseIsFulfilledWith(secondCallPromise, 2);
  });
});

// un appel atttends la fin de la résolution de tout autre appel ayant les "même" arguments
(0, _test.test)(function () {
  (0, _micmac.mockExecution)(function (_ref4) {
    var tick = _ref4.tick;

    var fn = function fn(promise, value) {
      return promise.then(function () {
        return value;
      });
    };
    var debounced = (0, _enqueueCall.enqueueCallByArgs)(fn);

    var firstPromise = (0, _promise.createPromiseAndHooks)();
    var secondPromise = (0, _promise.createPromiseAndHooks)();

    var firstCallPromise = debounced(firstPromise.promise, 1);
    var secondCallPromise = debounced(secondPromise.promise, 2);
    var thirdCallPromise = debounced(firstPromise.promise, 3);

    assertPromiseIsPending(firstCallPromise);
    assertPromiseIsPending(secondCallPromise);
    assertPromiseIsPending(thirdCallPromise);
    firstPromise.resolve();
    tick();
    assertPromiseIsFulfilledWith(firstCallPromise, 1);
    assertPromiseIsPending(secondCallPromise);
    assertPromiseIsFulfilledWith(thirdCallPromise, 3);
    secondPromise.resolve();
    tick();
    assertPromiseIsFulfilledWith(secondCallPromise, 2);
  });
});
//# sourceMappingURL=enqueueCall.test.js.map