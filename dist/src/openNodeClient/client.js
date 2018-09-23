"use strict";

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _ensureSystem = require("./ensureSystem.js");

var forceEnumerable = function forceEnumerable(value) {
  if (value === undefined || value === null || typeof value !== "object") {
    return value;
  }

  var enumerableValue = {};
  Object.getOwnPropertyNames(value).forEach(function (name) {
    var descriptor = Object.getOwnPropertyDescriptor(value, name);

    Object.defineProperty(enumerableValue, name, _extends({}, descriptor, { enumerable: true }, descriptor.hasOwnProperty("value") ? { value: forceEnumerable(descriptor.value) } : {}));
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
      return (0, _ensureSystem.ensureSystem)({ remoteRoot: remoteRoot, localRoot: localRoot })["import"](file).then(eval(teardownSource));
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