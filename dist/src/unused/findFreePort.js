"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.findFreePort = void 0;

var _net = _interopRequireDefault(require("net"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const findFreePort = ({
  ip = "localhost",
  min = 1,
  max = 65534,
  generateNext = port => port + 1
} = {}) => {
  const test = (port, ip) => {
    return new Promise((resolve, reject) => {
      const server = _net.default.createServer().listen(port, ip);

      server.on("listening", () => {
        server.close(() => {
          resolve(true);
        });
      });
      server.on("error", error => {
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

  const testPort = (port, ip) => {
    return test(port, ip).then(free => {
      if (free) {
        return port;
      }

      port = generateNext(port);

      if (port > max) {
        throw new Error(`no available port between ${min} and ${max} with ip ${ip}`);
      }

      return testPort(port, ip);
    });
  };

  return testPort(min, ip);
};

exports.findFreePort = findFreePort;
//# sourceMappingURL=findFreePort.js.map