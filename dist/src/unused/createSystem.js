"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createSystem = undefined;

var _systemjs = require("systemjs");

var _systemjs2 = _interopRequireDefault(_systemjs);

var _vm = require("vm");

var _vm2 = _interopRequireDefault(_vm);

var _readFileAsString = require("../readFileAsString.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var getNodeFilename = function getNodeFilename(filename) {
  filename = String(filename);
  // filename = path.resolve(process.cwd(), filename)
  filename = filename.replace(/\\/g, "/");

  // this logic sucks, let's try to avoid it completely
  // if (filename.slice(0, 2) === "//") {
  // 	filename = `${projectRoot}/${filename.slice(2)}`
  // } else if (filename[0] === "/") {
  // 	filename = `${rootFolder}/${filename.slice(2)}`
  // } else {
  // 	filename = `${rootFolder}/${filename}`
  // }

  if (filename.startsWith("file:///")) {
    return filename.slice("file:///".length);
  }

  return filename;
};
// import path from "path"
var createSystem = exports.createSystem = function createSystem(_ref) {
  var transpile = _ref.transpile;

  var mySystem = new _systemjs2["default"].constructor();
  var instantiate = _systemjs2["default"].constructor.instantiate;


  mySystem[instantiate] = function (key, processAnonRegister) {
    if (key.startsWith("@node/")) {
      return _systemjs2["default"][instantiate].apply(this, arguments);
    }

    var filename = getNodeFilename(key);

    return (0, _readFileAsString.readFileAsString)(filename).then(function (source) {
      return transpile(source, { filename: filename }).then(function (source) {
        global.System = mySystem;
        _vm2["default"].runInThisContext(source, { filename: filename });
        delete global.System;
        processAnonRegister();
      });
    });
  };

  mySystem.meta["*.json"] = { format: "json" };

  return mySystem;
};
//# sourceMappingURL=createSystem.js.map