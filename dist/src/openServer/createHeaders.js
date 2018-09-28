"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createHeaders = void 0;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

/*
https://developer.mozilla.org/en-US/docs/Web/API/Headers
https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
*/
var normalizeName = function normalizeName(headerName) {
  headerName = String(headerName);

  if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(headerName)) {
    throw new TypeError("Invalid character in header field name");
  }

  return headerName.toLowerCase();
};

var normalizeValue = function normalizeValue(headerValue) {
  return String(headerValue);
};

var convertToClientName = function convertToClientName(headerName) {
  return headerName;
}; // https://gist.github.com/mmazer/5404301


var parseHeaders = function parseHeaders(headerString) {
  var headers = {};
  var pairs;
  var pair;
  var index;
  var i;
  var j;
  var key;
  var value;

  if (headerString) {
    pairs = headerString.split("\r\n");
    i = 0;
    j = pairs.length;

    for (; i < j; i++) {
      pair = pairs[i];
      index = pair.indexOf(": ");

      if (index > 0) {
        key = pair.slice(0, index);
        value = pair.slice(index + 2);
        headers[key] = value;
      }
    }
  }

  return headers;
};

var createHeaders = function createHeaders(headers) {
  var _Object$freeze;

  var guard = "none";
  var map = new Map();

  var checkImmutability = function checkImmutability() {
    if (guard === "immutable") {
      throw new TypeError("headers are immutable");
    }
  };

  var has = function has(name) {
    return map.has(normalizeName(name));
  };

  var get = function get(name) {
    name = normalizeName(name);
    return map.has(name) ? map.get(name)[0] : null;
  };

  var getAll = function getAll(name) {
    name = normalizeName(name);
    return map.has(name) ? map.get(name) : [];
  };

  var set = function set(name, value) {
    checkImmutability();
    name = normalizeName(name);
    value = normalizeValue(value);
    map.set(name, [value]);
  };

  var append = function append(name, value) {
    checkImmutability();
    name = normalizeName(name);
    value = normalizeValue(value);
    var values;

    if (map.has(name)) {
      values = map.get(name);
    } else {
      values = [];
    }

    values.push(value);
    map.set(name, values);
  };

  var combine = function combine(name, value) {
    if (map.has(name)) {
      value = ", ".concat(normalizeValue(value));
    }

    return append(name, value);
  };

  var remove = function remove(name) {
    checkImmutability();
    name = normalizeName(name);
    return map.delete(name);
  };

  var entries = function entries() {
    return map.entries();
  };

  var keys = function keys() {
    return map.keys();
  };

  var values = function values() {
    return map.values();
  };

  var forEach = function forEach(fn, bind) {
    Array.from(entries()).forEach(function (_ref) {
      var _ref2 = _slicedToArray(_ref, 2),
          headerName = _ref2[0],
          headerValues = _ref2[1];

      headerValues.forEach(function (headerValue) {
        fn.call(bind, headerName, headerValue);
      });
    });
  };

  var toString = function toString() {
    var headers = Array.from(entries()).map(function (_ref3) {
      var _ref4 = _slicedToArray(_ref3, 2),
          headerName = _ref4[0],
          headerValues = _ref4[1];

      return "".concat(convertToClientName(headerName), ": ").concat(headerValues.join());
    });
    return headers.join("\r\n");
  };

  var toJSON = function toJSON() {
    var headers = {};
    Array.from(entries()).forEach(function (_ref5) {
      var _ref6 = _slicedToArray(_ref5, 2),
          headerName = _ref6[0],
          headerValues = _ref6[1];

      headers[convertToClientName(headerName)] = headerValues;
    });
    return headers;
  };

  var populate = function populate(headers) {
    if (typeof headers === "string") {
      headers = parseHeaders(headers);
    } else if (Symbol.iterator in headers) {
      Array.from(headers).forEach(function (_ref7) {
        var _ref8 = _slicedToArray(_ref7, 2),
            name = _ref8[0],
            values = _ref8[1];

        map.set(name, values);
      });
    } else if (_typeof(headers) === "object") {
      Object.keys(headers).forEach(function (name) {
        append(name, headers[name]);
      });
    }
  };

  if (headers) {
    populate(headers);
  }

  return Object.freeze((_Object$freeze = {
    has: has,
    get: get,
    getAll: getAll,
    set: set,
    append: append,
    combine: combine
  }, _defineProperty(_Object$freeze, "delete", remove), _defineProperty(_Object$freeze, Symbol.iterator, function () {
    return map[Symbol.iterator]();
  }), _defineProperty(_Object$freeze, "entries", entries), _defineProperty(_Object$freeze, "keys", keys), _defineProperty(_Object$freeze, "values", values), _defineProperty(_Object$freeze, "forEach", forEach), _defineProperty(_Object$freeze, "toString", toString), _defineProperty(_Object$freeze, "toJSON", toJSON), _Object$freeze));
};

exports.createHeaders = createHeaders;
//# sourceMappingURL=createHeaders.js.map