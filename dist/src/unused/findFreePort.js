"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findFreePort = undefined;

var _net = require("net");

var _net2 = _interopRequireDefault(_net);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var findFreePort = exports.findFreePort = function findFreePort() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$ip = _ref.ip,
      ip = _ref$ip === undefined ? "localhost" : _ref$ip,
      _ref$min = _ref.min,
      min = _ref$min === undefined ? 1 : _ref$min,
      _ref$max = _ref.max,
      max = _ref$max === undefined ? 65534 : _ref$max,
      _ref$generateNext = _ref.generateNext,
      generateNext = _ref$generateNext === undefined ? function (port) {
    return port + 1;
  } : _ref$generateNext;

  var test = function test(port, ip) {
    return new Promise(function (resolve, reject) {
      var server = _net2["default"].createServer().listen(port, ip);
      server.on("listening", function () {
        server.close(function () {
          resolve(true);
        });
      });
      server.on("error", function (error) {
        if (error && error.code === "EADDRINUSE") {
          return resolve(false);
        }
        if (error && error.code === "EACCES") {
          return resolve(false);
        }
        return reject(error);
      });
    });
  };

  var testPort = function testPort(port, ip) {
    return test(port, ip).then(function (free) {
      if (free) {
        return port;
      }
      port = generateNext(port);

      if (port > max) {
        throw new Error("no available port between " + min + " and " + max + " with ip " + ip);
      }

      return testPort(port, ip);
    });
  };

  return testPort(min, ip);
};
//# sourceMappingURL=findFreePort.js.map