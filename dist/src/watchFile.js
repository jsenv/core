"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.watchFile = void 0;

var _signal = require("@dmail/signal");

var _fs = _interopRequireDefault(require("fs"));

var _memoize = require("./memoize.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const getModificationDate = url => {
  return new Promise((resolve, reject) => {
    _fs.default.stat(url, (error, stat) => {
      if (error) {
        reject(error);
      } else {
        resolve(stat.mtime);
      }
    });
  });
};

const guardAsync = (fn, shield) => (...args) => {
  return Promise.resolve().then(() => shield(...args)).then(shielded => {
    return shielded ? undefined : fn(...args);
  });
};

const createChangedAsyncShield = ({
  value,
  get,
  compare
}) => {
  let lastValue;
  return (...args) => {
    return Promise.all([lastValue === undefined ? value : lastValue, Promise.resolve().then(() => get(...args))]).then(([previousValue, value]) => {
      lastValue = value;
      return !compare(previousValue, value);
    });
  };
};

const limitRate = (fn, ms) => {
  let canBeCalled = true;
  return (...args) => {
    if (!canBeCalled) {
      return undefined;
    }

    canBeCalled = false;
    setTimeout(() => {
      canBeCalled = true;
    }, ms);
    return fn(...args);
  };
};

const createWatchSignal = url => {
  // get mtime right now
  const mtime = getModificationDate(url);
  return (0, _signal.createSignal)({
    installer: ({
      emit
    }) => {
      const shield = createChangedAsyncShield({
        value: mtime,
        get: () => getModificationDate(url),
        compare: (modificationDate, nextModificationDate) => {
          return Number(modificationDate) !== Number(nextModificationDate);
        }
      });
      const guardedEmit = guardAsync(emit, shield); // https://nodejs.org/docs/latest/api/fs.html#fs_fs_watch_filename_options_listener

      const watcher = _fs.default.watch(url, {
        persistent: false
      }, limitRate((eventType, filename) => {
        guardedEmit({
          url,
          eventType,
          filename
        });
      }, 100));

      return () => watcher.close();
    }
  });
};

const memoizedCreateWatchSignal = (0, _memoize.memoizeSync)(createWatchSignal);

const watchFile = (url, fn) => {
  return memoizedCreateWatchSignal(url).listen(fn);
};

exports.watchFile = watchFile;
//# sourceMappingURL=watchFile.js.map