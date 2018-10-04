"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.watchFile = void 0;

var _signal = require("@dmail/signal");

var _fs = _interopRequireDefault(require("fs"));

var _memoize = require("../../memoize.js");

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
  return Promise.resolve().then(() => shield(...args)).then(shielded => shielded ? undefined : fn(...args));
};

const createChangedAsyncShield = ({
  value,
  get,
  compare
}) => {
  let lastValue;
  return () => {
    return Promise.all([lastValue === undefined ? value : lastValue, Promise.resolve().then(get)]).then(([previousValue, value]) => {
      lastValue = value;
      return compare(previousValue, value);
    });
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
        compare: (modificationDate, nextModificationDate) => Number(modificationDate) !== Number(nextModificationDate)
      }); // https://nodejs.org/docs/latest/api/fs.html#fs_class_fs_fswatcher

      const guardedEmit = guardAsync(emit, shield);

      const watcher = _fs.default.watch(url, {
        persistent: false
      }, (eventType, filename) => {
        guardedEmit({
          url,
          eventType,
          filename
        });
      });

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