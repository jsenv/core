"use strict";

var _ensureSystem = require("./ensureSystem.js");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var forceEnumerable = function forceEnumerable(value) {
  if (value === undefined || value === null || _typeof(value) !== "object") {
    return value;
  }

  var enumerableValue = {};
  Object.getOwnPropertyNames(value).forEach(function (name) {
    var descriptor = Object.getOwnPropertyDescriptor(value, name);
    Object.defineProperty(enumerableValue, name, _objectSpread({}, descriptor, {
      enumerable: true
    }, descriptor.hasOwnProperty("value") ? {
      value: forceEnumerable(descriptor.value)
    } : {}));
  });
  return enumerableValue;
};

process.on("message", function (_ref) {
  var type = _ref.type,
      id = _ref.id,
      data = _ref.data;

  if (type === "execute") {
    var remoteRoot = data.remoteRoot,
        localRoot = data.localRoot,
        file = data.file,
        setupSource = data.setupSource,
        teardownSource = data.teardownSource;
    Promise.resolve(file).then(eval(setupSource)).then(function () {
      return (0, _ensureSystem.ensureSystem)({
        remoteRoot: remoteRoot,
        localRoot: localRoot
      }).import(file).then(eval(teardownSource));
    }).then(function (value) {
      process.send({
        id: id,
        type: "execute-result",
        data: {
          code: 0,
          value: value
        }
      });
    }, function (reason) {
      // process.send algorithm does not send non enumerable values
      // but for error.message, error.stack we would like to get them
      // se we force all object properties to be enumerable
      // we could use @dmail/uneval here instead, for now let's keep it simple
      process.send({
        id: id,
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