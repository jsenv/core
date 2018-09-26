"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.guard = exports.guardAsync = void 0;

const guardAsync = (fn, shield) => (...args) => {
  return Promise.resolve().then(() => shield(...args)).then(shielded => shielded ? undefined : fn(...args));
};

exports.guardAsync = guardAsync;
const guard = guardAsync;
exports.guard = guard;
//# sourceMappingURL=guard.js.map