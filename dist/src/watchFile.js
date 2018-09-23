"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.watchFile = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _signal = require("@dmail/signal");

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _memoize = require("./memoize.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var getModificationDate = function getModificationDate(url) {
  return new Promise(function (resolve, reject) {
    _fs2["default"].stat(url, function (error, stat) {
      if (error) {
        reject(error);
      } else {
        resolve(stat.mtime);
      }
    });
  });
};

var guardAsync = function guardAsync(fn, shield) {
  return function () {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return Promise.resolve().then(function () {
      return shield.apply(undefined, args);
    }).then(function (shielded) {
      return shielded ? undefined : fn.apply(undefined, args);
    });
  };
};

var createChangedAsyncShield = function createChangedAsyncShield(_ref) {
  var value = _ref.value,
      get = _ref.get,
      compare = _ref.compare;

  var lastValue = void 0;

  return function () {
    for (var _len2 = arguments.length, args = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      args[_key2] = arguments[_key2];
    }

    return Promise.all([lastValue === undefined ? value : lastValue, Promise.resolve().then(function () {
      return get.apply(undefined, args);
    })]).then(function (_ref2) {
      var _ref3 = _slicedToArray(_ref2, 2),
          previousValue = _ref3[0],
          value = _ref3[1];

      lastValue = value;
      return !compare(previousValue, value);
    });
  };
};

var limitRate = function limitRate(fn, ms) {
  var canBeCalled = true;
  return function () {
    if (!canBeCalled) {
      return undefined;
    }

    canBeCalled = false;
    setTimeout(function () {
      canBeCalled = true;
    }, ms);
    return fn.apply(undefined, arguments);
  };
};

var createWatchSignal = function createWatchSignal(url) {
  // get mtime right now
  var mtime = getModificationDate(url);

  return (0, _signal.createSignal)({
    installer: function installer(_ref4) {
      var emit = _ref4.emit;

      var shield = createChangedAsyncShield({
        value: mtime,
        get: function get() {
          return getModificationDate(url);
        },
        compare: function compare(modificationDate, nextModificationDate) {
          return Number(modificationDate) !== Number(nextModificationDate);
        }
      });

      var guardedEmit = guardAsync(emit, shield);
      // https://nodejs.org/docs/latest/api/fs.html#fs_fs_watch_filename_options_listener
      var watcher = _fs2["default"].watch(url, { persistent: false }, limitRate(function (eventType, filename) {
        guardedEmit({ url: url, eventType: eventType, filename: filename });
      }, 100));
      return function () {
        return watcher.close();
      };
    }
  });
};

var memoizedCreateWatchSignal = (0, _memoize.memoizeSync)(createWatchSignal);

var watchFile = exports.watchFile = function watchFile(url, fn) {
  return memoizedCreateWatchSignal(url).listen(fn);
};
//# sourceMappingURL=watchFile.js.map