"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.memoize = void 0;

/*

on pourras largemtent s'inspirer de:

https://github.com/jsenv/core/blob/959e76068b62c23d7047f6a8c7a3d6582ac25177/src/api/util/store.js
https://github.com/jsenv/core/blob/959e76068b62c23d7047f6a8c7a3d6582ac25177/src/api/util/memoize.js

*/
const memoize = ({
  fn,
  set,
  get,
  identify
}) => {
  const memoized = (...args) => {
    const id = identify(args);
    return get(id).then(({
      valid,
      value
    }) => {
      if (valid) {
        return value;
      }

      return fn(...args).then(value => {
        return set(id, value).then(() => value);
      });
    });
  };

  return memoized;
};

exports.memoize = memoize;
//# sourceMappingURL=memoizer.js.map