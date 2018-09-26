"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getFromProcessArguments = void 0;

const getFromProcessArguments = name => {
  const rawBooleanArg = process.argv.find(arg => {
    return arg === `--${name}`;
  });

  if (rawBooleanArg) {
    return true;
  }

  const rawValueArg = process.argv.find(arg => {
    return arg.startsWith(`--${name}=`);
  });

  if (!rawValueArg) {
    return false;
  }

  return rawValueArg.slice(`--${name}=`.length);
};

exports.getFromProcessArguments = getFromProcessArguments;
//# sourceMappingURL=getFromProcessArguments.js.map