"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var getFromProcessArguments = exports.getFromProcessArguments = function getFromProcessArguments(name) {
  var rawBooleanArg = process.argv.find(function (arg) {
    return arg === "--" + name;
  });
  if (rawBooleanArg) {
    return true;
  }

  var rawValueArg = process.argv.find(function (arg) {
    return arg.startsWith("--" + name + "=");
  });
  if (!rawValueArg) {
    return false;
  }

  return rawValueArg.slice(("--" + name + "=").length);
};
//# sourceMappingURL=getFromProcessArguments.js.map