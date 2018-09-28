"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createPromiseAndHooks = void 0;

var createPromiseAndHooks = function createPromiseAndHooks() {
  var resolve;
  var reject;
  var promise = new Promise(function (res, rej) {
    resolve = res;
    reject = rej;
  });
  return {
    promise: promise,
    resolve: resolve,
    reject: reject
  };
};

exports.createPromiseAndHooks = createPromiseAndHooks;
//# sourceMappingURL=promise.js.map