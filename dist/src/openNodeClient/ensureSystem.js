"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ensureSystem = void 0;

var _node = require("@dmail/module-loader/node.js");

const memoize = fn => {
  let called = false;
  let memoizedValue;
  return (...args) => {
    if (called) {
      return memoizedValue;
    }

    memoizedValue = fn(...args);
    called = true;
    return memoizedValue;
  };
};

const ensureSystem = memoize(({
  localRoot,
  forceFilesystem = true
}) => {
  // when System.import evaluates the code it has fetched
  // it uses require('vm').runInThisContext(code, { filename }).
  // This filename is very important because it allows the engine to be able
  // to resolve source map location inside evaluated code like 
  // and also to know where the file is to resolve other file when evaluating code
  const getFilename = (key, location) => {
    if (forceFilesystem) {
      // try to force filesystem resolution
      // replace https://ip:port/folder/file.js -> /Users/dmail/folder/file.js
      // const filename = key.replace(remoteRoot, localRoot)
      // replace https://ip:port/folder/file.js -> /Users/dmail/folder/file.js/d3eui56uui/file.js
      const filename = `${localRoot}/${location}`;
      return filename;
    }

    return key;
  };

  const System = (0, _node.createNodeLoader)({
    getFilename
  });
  global.System = System;
  return System;
});
exports.ensureSystem = ensureSystem;
//# sourceMappingURL=ensureSystem.js.map