"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findFreePort = void 0;

var _net = _interopRequireDefault(require("net"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var findFreePort = function findFreePort() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$ip = _ref.ip,
      ip = _ref$ip === void 0 ? "localhost" : _ref$ip,
      _ref$min = _ref.min,
      min = _ref$min === void 0 ? 1 : _ref$min,
      _ref$max = _ref.max,
      max = _ref$max === void 0 ? 65534 : _ref$max,
      _ref$generateNext = _ref.generateNext,
      generateNext = _ref$generateNext === void 0 ? function (port) {
    return port + 1;
  } : _ref$generateNext;

  var test = function test(port, ip) {
    return new Promise(function (resolve, reject) {
      var server = _net.default.createServer().listen(port, ip);

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
        throw new Error("no available port between ".concat(min, " and ").concat(max, " with ip ").concat(ip));
      }

      return testPort(port, ip);
    });
  };

  return testPort(min, ip);
};

exports.findFreePort = findFreePort;
//# sourceMappingURL=findFreePort.js.map