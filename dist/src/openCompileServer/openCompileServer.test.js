"use strict";

var _path = _interopRequireDefault(require("path"));

var _openCompileServer = require("./openCompileServer.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const rootLocation = _path.default.resolve(__dirname, "../../../");

(0, _openCompileServer.openCompileServer)({
  url: "http://127.0.0.1:8998",
  rootLocation
}).then(({
  url
}) => {
  console.log(`compiling ${rootLocation} at ${url}`);
});
//# sourceMappingURL=openCompileServer.test.js.map