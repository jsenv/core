"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getFromProcessArguments = void 0;

var getFromProcessArguments = function getFromProcessArguments(name) {
  var rawBooleanArg = process.argv.find(function (arg) {
    return arg === "--".concat(name);
  });

  if (rawBooleanArg) {
    return true;
  }

  var rawValueArg = process.argv.find(function (arg) {
    return arg.startsWith("--".concat(name, "="));
  });

  if (!rawValueArg) {
    return false;
  }

  return rawValueArg.slice("--".concat(name, "=").length);
};

exports.getFromProcessArguments = getFromProcessArguments;
//# sourceMappingURL=getFromProcessArguments.js.map