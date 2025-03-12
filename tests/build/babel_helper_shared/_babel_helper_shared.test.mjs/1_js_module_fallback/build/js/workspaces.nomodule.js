System.register([], function (_export, _context) {
  "use strict";

  var arrayWithHoles, nonIterableRest, _slicedToArray, defineProperty;
  /* @minVersion 7.0.0-beta.0 */

  function _iterableToArrayLimit(arr, i) {
    // this is an expanded form of \`for...of\` that properly supports abrupt completions of
    // iterators etc. variable names have been minimised to reduce the size of this massive
    // helper. sometimes spec compliance is annoying :(
    //
    // _n = _iteratorNormalCompletion
    // _d = _didIteratorError
    // _e = _iteratorError
    // _i = _iterator
    // _s = _step
    // _x = _next
    // _r = _return

    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];
    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;
    var _s, _e, _x, _r;
    try {
      _x = (_i = _i.call(arr)).next;
      if (i === 0) {
        if (Object(_i) !== _i) return;
        _n = false;
      } else {
        for (; !(_n = (_s = _x.call(_i)).done); _n = true) {
          _arr.push(_s.value);
          if (_arr.length === i) break;
        }
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) {
          _r = _i["return"]();
          // eslint-disable-next-line no-unsafe-finally
          if (Object(_r) !== _r) return;
        }
      } finally {
        // eslint-disable-next-line no-unsafe-finally
        if (_d) throw _e;
      }
    }
    return _arr;
  }

  /* eslint-disable no-eq-null, eqeqeq */
  function arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    var arr2 = new Array(len);
    for (var i = 0; i < len; i++) arr2[i] = arr[i];
    return arr2;
  }

  /* eslint-disable consistent-return */
  function unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
  }
  /* @minVersion 7.1.5 */

  // https://tc39.es/ecma262/#sec-toprimitive
  function toPrimitive(input, hint) {
    if (typeof input !== "object" || !input) return input;
    // @ts-expect-error Symbol.toPrimitive might not index {}
    var prim = input[Symbol.toPrimitive];
    if (prim !== undefined) {
      var res = prim.call(input, hint);
      if (typeof res !== "object") return res;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return (hint === "string" ? String : Number)(input);
  }

  /* @minVersion 7.1.5 */

  function toPropertyKey(arg) {
    var key = toPrimitive(arg, "string");
    return typeof key === "symbol" ? key : String(key);
  }
  /* @minVersion 7.5.0 */

  // This function is different to "Reflect.ownKeys". The enumerableOnly
  // filters on symbol properties only. Returned string properties are always
  // enumerable. It is good to use in objectSpread.

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      if (enumerableOnly) {
        symbols = symbols.filter(function (sym) {
          return Object.getOwnPropertyDescriptor(object, sym).enumerable;
        });
      }
      keys.push.apply(keys, symbols);
    }
    return keys;
  }
  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};
      if (i % 2) {
        ownKeys(Object(source), true).forEach(function (key) {
          defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }
    return target;
  }
  _export("_objectSpread2", _objectSpread2);
  return {
    setters: [],
    execute: function () {
      // eslint-disable-next-line consistent-return
      arrayWithHoles = arr => {
        if (Array.isArray(arr)) return arr;
      };
      nonIterableRest = () => {
        throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
      };
      _export("_slicedToArray", _slicedToArray = (arr, i) => arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || unsupportedIterableToArray(arr, i) || nonIterableRest());
      defineProperty = (obj, key, value) => {
        key = toPropertyKey(key);
        // Shortcircuit the slow defineProperty path when possible.
        // We are trying to avoid issues where setters defined on the
        // prototype cause side effects under the fast path of simple
        // assignment. By checking for existence of the property with
        // the in operator, we can optimize most of this overhead away.
        if (key in obj) {
          Object.defineProperty(obj, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true
          });
        } else {
          obj[key] = value;
        }
        return obj;
      };
    }
  };
});