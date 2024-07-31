System.register([], function (_export, _context) {
  "use strict";

  var arrayWithHoles, nonIterableRest, _slicedToArray;
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
      Promise.all([_context.import(__v__("/js/a.nomodule.js")), _context.import(__v__("/js/b.nomodule.js"))]).then(_ref => {
        let _ref2 = _slicedToArray(_ref, 2),
          a = _ref2[0].a,
          b = _ref2[1].b;
        window.resolveResultPromise({
          a,
          b
        });
      });
    }
  };
});