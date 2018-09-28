"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createSystem = void 0;

var _systemjs = _interopRequireDefault(require("systemjs"));

var _vm = _interopRequireDefault(require("vm"));

var _readFileAsString = require("../readFileAsString.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import path from "path"
var getNodeFilename = function getNodeFilename(filename) {
  filename = String(filename); // filename = path.resolve(process.cwd(), filename)

  filename = filename.replace(/\\/g, "/"); // this logic sucks, let's try to avoid it completely
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

var createSystem = function createSystem(_ref) {
  var transpile = _ref.transpile;
  var mySystem = new _systemjs.default.constructor();
  var instantiate = _systemjs.default.constructor.instantiate;

  mySystem[instantiate] = function (key, processAnonRegister) {
    if (key.startsWith("@node/")) {
      return _systemjs.default[instantiate].apply(this, arguments);
    }

    var filename = getNodeFilename(key);
    return (0, _readFileAsString.readFileAsString)(filename).then(function (source) {
      return transpile(source, {
        filename: filename
      }).then(function (source) {
        global.System = mySystem;

        _vm.default.runInThisContext(source, {
          filename: filename
        });

        delete global.System;
        processAnonRegister();
      });
    });
  };

  mySystem.meta["*.json"] = {
    format: "json"
  };
  return mySystem;
};

exports.createSystem = createSystem;
//# sourceMappingURL=createSystem.js.map