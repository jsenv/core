"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ensureSystem = void 0;

var _node = require("@dmail/module-loader/node.js");

var memoize = function memoize(fn) {
  var called = false;
  var memoizedValue;
  return function () {
    if (called) {
      return memoizedValue;
    }

    memoizedValue = fn.apply(void 0, arguments);
    called = true;
    return memoizedValue;
  };
};

var ensureSystem = memoize(function (_ref) {
  var localRoot = _ref.localRoot,
      _ref$forceFilesystem = _ref.forceFilesystem,
      forceFilesystem = _ref$forceFilesystem === void 0 ? true : _ref$forceFilesystem;

  // when System.import evaluates the code it has fetched
  // it uses require('vm').runInThisContext(code, { filename }).
  // This filename is very important because it allows the engine to be able
  // to resolve source map location inside evaluated code like 
  // and also to know where the file is to resolve other file when evaluating code
  var getFilename = function getFilename(key, location) {
    if (forceFilesystem) {
      // try to force filesystem resolution
      // replace https://ip:port/folder/file.js -> /Users/dmail/folder/file.js
      // const filename = key.replace(remoteRoot, localRoot)
      // replace https://ip:port/folder/file.js -> /Users/dmail/folder/file.js/d3eui56uui/file.js
      var filename = "".concat(localRoot, "/").concat(location);
      return filename;
    }

    return key;
  };

  var System = (0, _node.createNodeLoader)({
    getFilename: getFilename
  });
  global.System = System;
  return System;
});
exports.ensureSystem = ensureSystem;
//# sourceMappingURL=ensureSystem.js.map