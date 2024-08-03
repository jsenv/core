System.register([], function (_export, _context) {
  "use strict";

  var defineProperty;
  /* @minVersion 7.1.5 */

  // https://tc39.es/ecma262/#sec-toprimitive
  function toPrimitive(input, hint) {
    if (typeof input !== "object" || !input) return input;
    // @ts-expect-error Symbol.toPrimitive might not index {}
    var prim = input[Symbol.toPrimitive];
    if (prim !== undefined) {
      var res = prim.call(input, hint || "default");
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