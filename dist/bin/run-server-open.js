"use strict";

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _runServer = require("./run-server.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var getFromArguments = function getFromArguments(name) {
  var foundRawArg = process.argv.find(function (arg) {
    return arg.startsWith("--" + name + "=");
  });
  if (!foundRawArg) {
    return;
  }
  return foundRawArg.slice(("--" + name + "=").length);
};

var root = getFromArguments("root") || _path2["default"].resolve(__dirname, "../../");
var port = Number(getFromArguments("port") || "3000");

(0, _runServer.open)({
  root: root,
  compiledFolder: "compiled",
  url: "http://127.0.0.1:" + port
}).then(function (_ref) {
  var compileURL = _ref.compileURL,
      runURL = _ref.runURL;

  console.log("compile server listening at", compileURL.toString());
  console.log("run server listening at " + runURL);
});
//# sourceMappingURL=run-server-open.js.map