"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var createPromiseAndHooks = exports.createPromiseAndHooks = function createPromiseAndHooks() {
  var resolve = void 0;
  var reject = void 0;
  var promise = new Promise(function (res, rej) {
    resolve = res;
    reject = rej;
  });

  return { promise: promise, resolve: resolve, reject: reject };
};
//# sourceMappingURL=promise.js.map