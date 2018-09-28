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
var memoize = function memoize(_ref) {
  var fn = _ref.fn,
      set = _ref.set,
      get = _ref.get,
      identify = _ref.identify;

  var memoized = function memoized() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var id = identify(args);
    return get(id).then(function (_ref2) {
      var valid = _ref2.valid,
          value = _ref2.value;

      if (valid) {
        return value;
      }

      return fn.apply(void 0, args).then(function (value) {
        return set(id, value).then(function () {
          return value;
        });
      });
    });
  };

  return memoized;
};

exports.memoize = memoize;
//# sourceMappingURL=memoizer.js.map