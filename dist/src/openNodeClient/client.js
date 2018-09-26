"use strict";

var _ensureSystem = require("./ensureSystem.js");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const forceEnumerable = value => {
  if (value === undefined || value === null || typeof value !== "object") {
    return value;
  }

  const enumerableValue = {};
  Object.getOwnPropertyNames(value).forEach(name => {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    Object.defineProperty(enumerableValue, name, _objectSpread({}, descriptor, {
      enumerable: true
    }, descriptor.hasOwnProperty("value") ? {
      value: forceEnumerable(descriptor.value)
    } : {}));
  });
  return enumerableValue;
};

process.on("message", ({
  type,
  id,
  data
}) => {
  if (type === "execute") {
    const {
      remoteRoot,
      localRoot,
      file,
      setupSource,
      teardownSource
    } = data;
    Promise.resolve(file).then(eval(setupSource)).then(() => {
      return (0, _ensureSystem.ensureSystem)({
        remoteRoot,
        localRoot
      }).import(file).then(eval(teardownSource));
    }).then(value => {
      process.send({
        id,
        type: "execute-result",
        data: {
          code: 0,
          value
        }
      });
    }, reason => {
      // process.send algorithm does not send non enumerable values
      // but for error.message, error.stack we would like to get them
      // se we force all object properties to be enumerable
      // we could use @dmail/uneval here instead, for now let's keep it simple
      process.send({
        id,
        type: "execute-result",
        data: {
          code: 1,
          value: forceEnumerable(reason)
        }
      });
    });
  }
});
//# sourceMappingURL=client.js.map