"use strict";

var _path = _interopRequireDefault(require("path"));

var _openCompileServer = require("../openCompileServer/openCompileServer.js");

var _openNodeClient = require("./openNodeClient.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const rootLocation = _path.default.resolve(__dirname, "../../../");

(0, _openCompileServer.openCompileServer)({
  url: "http://127.0.0.1:8765",
  rootLocation,
  sourceMap: "comment",
  sourceURL: false,
  instrument: false
}).then(server => {
  return (0, _openNodeClient.openNodeClient)({
    compileURL: server.compileURL,
    remoteRoot: "http://127.0.0.1:8765",
    localRoot: rootLocation,
    detached: true // true,

  }).then(nodeClient => {
    nodeClient.execute({
      file: `src/__test__/file.js`,
      collectCoverage: false
    }).then(({
      promise,
      close
    }) => {
      promise.then(value => {
        close();
        server.close();
        console.log("execution done with", value);
      }, reason => {
        console.error("execution crashed with", reason);
      });
    });
  });
});
//# sourceMappingURL=openNodeClient.test.js.map