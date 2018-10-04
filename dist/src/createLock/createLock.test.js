"use strict";

var _test = require("@dmail/test");

var _assert = _interopRequireDefault(require("assert"));

var _micmac = require("micmac");

var _promise = require("../promise.js");

var _createLock = require("./createLock.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const assertPromiseIsPending = promise => {
  (0, _assert.default)(promise.status === "pending" || promise.status === "resolved");
};

const assertPromiseIsFulfilled = promise => {
  _assert.default.equal(promise.status, "fulfilled");
};

const assertPromiseIsRejected = promise => {
  _assert.default.equal(promise.status, "rejected");
};

const assertPromiseIsFulfilledWith = (promise, value) => {
  assertPromiseIsFulfilled(promise);

  _assert.default.equal(promise.value, value);
};

const assertPromiseIsRejectedWith = (promise, value) => {
  assertPromiseIsRejected(promise);

  _assert.default.equal(promise.value, value);
};

(0, _test.test)(() => {
  (0, _micmac.mockExecution)(({
    tick
  }) => {
    const lock = (0, _createLock.createLockRegistry)().lockForRessource();
    const {
      promise,
      resolve
    } = (0, _promise.createPromiseAndHooks)();
    const returnedPromise = lock.chain(() => promise);
    assertPromiseIsPending(returnedPromise);
    resolve(1);
    tick();
    assertPromiseIsFulfilledWith(returnedPromise, 1);
  });
});
(0, _test.test)(() => {
  (0, _micmac.mockExecution)(({
    tick
  }) => {
    const lock = (0, _createLock.createLockRegistry)().lockForRessource();
    const {
      promise,
      reject
    } = (0, _promise.createPromiseAndHooks)();
    const returnedPromise = lock.chain(() => promise);
    assertPromiseIsPending(returnedPromise);
    reject(1);
    tick();
    assertPromiseIsRejectedWith(returnedPromise, 1);
  });
}); // un appel attends la résolution de tout autre appel en cours

(0, _test.test)(() => {
  (0, _micmac.mockExecution)(({
    tick
  }) => {
    const lock = (0, _createLock.createLockRegistry)().lockForRessource();
    const firstPromise = (0, _promise.createPromiseAndHooks)();
    const firstCallPromise = lock.chain(() => firstPromise.promise.then(() => 1));
    const secondPromise = (0, _promise.createPromiseAndHooks)();
    const secondCallPromise = lock.chain(() => secondPromise.promise.then(() => 2));
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

(0, _test.test)(() => {
  (0, _micmac.mockExecution)(({
    tick
  }) => {
    const registry = (0, _createLock.createLockRegistry)();
    const lock1 = registry.lockForRessource(1);
    const lock2 = registry.lockForRessource(2);
    const firstPromise = (0, _promise.createPromiseAndHooks)();
    const secondPromise = (0, _promise.createPromiseAndHooks)();
    const firstCallPromise = lock1.chain(() => firstPromise.promise);
    const secondCallPromise = lock2.chain(() => secondPromise.promise);
    const thirdCallPromise = lock1.chain(() => firstPromise.promise);
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