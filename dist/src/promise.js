"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createPromiseAndHooks = void 0;

const createPromiseAndHooks = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve,
    reject
  };
};

exports.createPromiseAndHooks = createPromiseAndHooks;
//# sourceMappingURL=promise.js.map