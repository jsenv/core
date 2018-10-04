"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openIndexServer = void 0;

var _openServer = require("../openServer/openServer.js");

const openIndexServer = ({
  url,
  body
}) => {
  return (0, _openServer.openServer)({
    url
  }).then(server => {
    server.addRequestHandler(() => {
      return {
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": Buffer.byteLength(body),
          "cache-control": "no-store"
        },
        body
      };
    });
    return {
      url: server.url,
      close: server.close
    };
  });
};

exports.openIndexServer = openIndexServer;
//# sourceMappingURL=openIndexServer.js.map