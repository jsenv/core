"use strict";

var _test = require("@dmail/test");

var _assert = _interopRequireDefault(require("assert"));

var _micmac = require("micmac");

var _promise = require("../promise.js");

var _createLock = require("./createLock.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var assertPromiseIsPending = function assertPromiseIsPending(promise) {
  (0, _assert.default)(promise.status === "pending" || promise.status === "resolved");
};

var assertPromiseIsFulfilled = function assertPromiseIsFulfilled(promise) {
  _assert.default.equal(promise.status, "fulfilled");
};

var assertPromiseIsRejected = function assertPromiseIsRejected(promise) {
  _assert.default.equal(promise.status, "rejected");
};

var assertPromiseIsFulfilledWith = function assertPromiseIsFulfilledWith(promise, value) {
  assertPromiseIsFulfilled(promise);

  _assert.default.equal(promise.value, value);
};

var assertPromiseIsRejectedWith = function assertPromiseIsRejectedWith(promise, value) {
  assertPromiseIsRejected(promise);

  _assert.default.equal(promise.value, value);
};

(0, _test.test)(function () {
  (0, _micmac.mockExecution)(function (_ref) {
    var tick = _ref.tick;
    var lock = (0, _createLock.createLockRegistry)().lockForRessource();

    var _createPromiseAndHook = (0, _promise.createPromiseAndHooks)(),
        promise = _createPromiseAndHook.promise,
        resolve = _createPromiseAndHook.resolve;

    var returnedPromise = lock.chain(function () {
      return promise;
    });
    assertPromiseIsPending(returnedPromise);
    resolve(1);
    tick();
    assertPromiseIsFulfilledWith(returnedPromise, 1);
  });
});
(0, _test.test)(function () {
  (0, _micmac.mockExecution)(function (_ref2) {
    var tick = _ref2.tick;
    var lock = (0, _createLock.createLockRegistry)().lockForRessource();

    var _createPromiseAndHook2 = (0, _promise.createPromiseAndHooks)(),
        promise = _createPromiseAndHook2.promise,
        reject = _createPromiseAndHook2.reject;

    var returnedPromise = lock.chain(function () {
      return promise;
    });
    assertPromiseIsPending(returnedPromise);
    reject(1);
    tick();
    assertPromiseIsRejectedWith(returnedPromise, 1);
  });
}); // un appel attends la résolution de tout autre appel en cours

(0, _test.test)(function () {
  (0, _micmac.mockExecution)(function (_ref3) {
    var tick = _ref3.tick;
    var lock = (0, _createLock.createLockRegistry)().lockForRessource();
    var firstPromise = (0, _promise.createPromiseAndHooks)();
    var firstCallPromise = lock.chain(function () {
      return firstPromise.promise.then(function () {
        return 1;
      });
    });
    var secondPromise = (0, _promise.createPromiseAndHooks)();
    var secondCallPromise = lock.chain(function () {
      return secondPromise.promise.then(function () {
        return 2;
      });
    });
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
}); // un appel atttends la fin de la résolution de tout autre appel ayant les "même" arguments

(0, _test.test)(function () {
  (0, _micmac.mockExecution)(function (_ref4) {
    var tick = _ref4.tick;
    var registry = (0, _createLock.createLockRegistry)();
    var lock1 = registry.lockForRessource(1);
    var lock2 = registry.lockForRessource(2);
    var firstPromise = (0, _promise.createPromiseAndHooks)();
    var secondPromise = (0, _promise.createPromiseAndHooks)();
    var firstCallPromise = lock1.chain(function () {
      return firstPromise.promise;
    });
    var secondCallPromise = lock2.chain(function () {
      return secondPromise.promise;
    });
    var thirdCallPromise = lock1.chain(function () {
      return firstPromise.promise;
    });
    assertPromiseIsPending(firstCallPromise);
    assertPromiseIsPending(secondCallPromise);
    assertPromiseIsPending(thirdCallPromise);
    firstPromise.resolve(1);
    tick();
    assertPromiseIsFulfilledWith(firstCallPromise, 1);
    assertPromiseIsPending(secondCallPromise);
    assertPromiseIsFulfilledWith(thirdCallPromise, 1);
    secondPromise.resolve(2);
    tick();
    assertPromiseIsFulfilledWith(secondCallPromise, 2);
  });
});
//# sourceMappingURL=createLock.test.js.map