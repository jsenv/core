"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var createStore = exports.createStore = function createStore() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$compare = _ref.compare,
      compare = _ref$compare === undefined ? function (args, savedArgs) {
    if (savedArgs.length !== args.length) {
      return false;
    }
    return savedArgs.every(function (savedArg, index) {
      var arg = args[index];
      if (arg !== savedArg) {
        // should be a bit more powerfull to compare shallow here
        return false;
      }
      return true;
    });
  } : _ref$compare,
      _ref$maxLength = _ref.maxLength,
      maxLength = _ref$maxLength === undefined ? 100 : _ref$maxLength,
      _ref$transform = _ref.transform,
      transform = _ref$transform === undefined ? function (v) {
    return v;
  } : _ref$transform;

  var entries = [];

  var restore = function restore() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var foundEntry = entries.find(function (_ref2) {
      var savedArgs = _ref2.savedArgs;
      return compare(args, savedArgs);
    });
    return {
      has: Boolean(foundEntry),
      value: foundEntry ? foundEntry.value : undefined
    };
  };

  var save = function save(value) {
    for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }

    if (entries.length >= maxLength) {
      entries.shift();
    }
    entries.push({ value: value, savedArgs: args });
  };

  return {
    restore: restore,
    save: save,
    transform: transform
  };
};

var memoize = exports.memoize = function memoize(fn) {
  var _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : createStore(),
      restore = _ref3.restore,
      save = _ref3.save,
      transform = _ref3.transform;

  return function () {
    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    return Promise.resolve(restore.apply(undefined, args)).then(function (_ref4) {
      var has = _ref4.has,
          value = _ref4.value;

      if (has) {
        return transform.apply(undefined, [value].concat(args));
      }
      var freshValue = fn.apply(undefined, args);
      save.apply(undefined, [freshValue].concat(args));
      return transform.apply(undefined, [freshValue].concat(args));
    });
  };
};

var memoizeSync = exports.memoizeSync = function memoizeSync(fn) {
  var _ref5 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : createStore(),
      restore = _ref5.restore,
      save = _ref5.save,
      transform = _ref5.transform;

  return function () {
    for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }

    var _restore = restore.apply(undefined, args),
        has = _restore.has,
        value = _restore.value;

    if (has) {
      return transform.apply(undefined, [value].concat(args));
    }
    var freshValue = fn.apply(undefined, args);
    save.apply(undefined, [freshValue].concat(args));
    return transform.apply(undefined, [freshValue].concat(args));
  };
};
//# sourceMappingURL=memoize.js.map