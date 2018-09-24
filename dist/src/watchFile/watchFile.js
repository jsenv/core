"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.watchFile = undefined;

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _action = require("@dmail/action");

var _signal = require("@dmail/signal");

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _guard = require("../guard.js");

var _memoize = require("../memoize.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var getModificationDate = function getModificationDate(url) {
  var action = (0, _action.createAction)();

  _fs2["default"].stat(url, function (error, stat) {
    if (error) {
      throw error;
    } else {
      action.pass(stat.mtime);
    }
  });

  return action;
};

var createChangedAsyncShield = function createChangedAsyncShield(read, compare) {
  var currentValueAction = (0, _action.passed)(read());

  return function () {
    var nextValueAction = (0, _action.passed)(read());
    return (0, _action.all)([currentValueAction, nextValueAction]).then(function (_ref) {
      var _ref2 = _slicedToArray(_ref, 2),
          value = _ref2[0],
          nextValue = _ref2[1];

      currentValueAction = nextValueAction;
      return compare(value, nextValue) ? (0, _action.passed)() : (0, _action.failed)();
    });
  };
};

var createWatchSignal = function createWatchSignal(url) {
  var shield = createChangedAsyncShield(function () {
    return getModificationDate(url);
  }, function (modificationDate, nextModificationDate) {
    return Number(modificationDate) !== Number(nextModificationDate);
  });

  return (0, _signal.createSignal)({
    installer: function installer(_ref3) {
      var emit = _ref3.emit;

      // https://nodejs.org/docs/latest/api/fs.html#fs_class_fs_fswatcher
      var guardedEmit = (0, _guard.guardAsync)(emit, shield);
      var watcher = _fs2["default"].watch(url, { persistent: false }, function (eventType, filename) {
        guardedEmit({ url: url, eventType: eventType, filename: filename });
      });
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