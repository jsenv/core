"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
// https://github.com/jsenv/core/blob/master/src/util/rest/helpers.js

var createResponseGenerator = exports.createResponseGenerator = function createResponseGenerator(_ref) {
  var _ref$services = _ref.services,
      services = _ref$services === undefined ? [] : _ref$services;

  var generateResponse = function generateResponse() {
    for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return new Promise(function (resolve, reject) {
      var visit = function visit(index) {
        if (index >= services.length) {
          return resolve();
        }

        var service = services[index];
        Promise.resolve(service.apply(undefined, args)).then(function (value) {
          if (value) {
            resolve(value);
          } else {
            visit(index + 1);
          }
        }, function (value) {
          if (value) {
            reject(value);
          } else {
            visit(index + 1);
          }
        });
      };

      visit(0);
    }).then(function (value) {
      if (value) {
        return value;
      }
      return { status: 501, reason: "no implemented" };
    });
  };

  return generateResponse;
};
//# sourceMappingURL=createResponseGenerator.js.map