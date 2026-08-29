/* eslint-disable */
export default function regeneratorDefine(obj, key, value, noFlags) {
  var define = Object.defineProperty;
  try {
    define({}, "", {});
  } catch (_) {
    define = 0;
  }
  regeneratorDefine = function (obj, key, value, noFlags) {
    function defineIteratorMethod(method, i) {
      regeneratorDefine(obj, method, function (arg) {
        return this._invoke(method, i, arg);
      });
    }
    if (!key) {
      defineIteratorMethod("next", 0);
      defineIteratorMethod("throw", 1);
      defineIteratorMethod("return", 2);
    } else {
      if (define) {
        define(obj, key, {
          value: value,
          enumerable: !noFlags,
          configurable: !noFlags,
          writable: !noFlags
        });
      } else {
        obj[key] = value;
      }
    }
  };
  regeneratorDefine(obj, key, value, noFlags);
}
