"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
/*

on pourras largemtent s'inspirer de:

https://github.com/jsenv/core/blob/959e76068b62c23d7047f6a8c7a3d6582ac25177/src/api/util/store.js
https://github.com/jsenv/core/blob/959e76068b62c23d7047f6a8c7a3d6582ac25177/src/api/util/memoize.js

*/

var memoize = exports.memoize = function memoize(_ref) {
  var fn = _ref.fn,
      set = _ref.set,
      get = _ref.get,
      identify = _ref.identify;

  var memoized = function memoized() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var id = identify(args);
    return get(id).then(function (_ref2) {
      var valid = _ref2.valid,
          value = _ref2.value;

      if (valid) {
        return value;
      }
      return fn.apply(undefined, args).then(function (value) {
        return set(id, value).then(function () {
          return value;
        });
      });
    });
  };

  return memoized;
};
//# sourceMappingURL=memoizer.js.map