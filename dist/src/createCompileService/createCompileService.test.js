"use strict";

var _assert = _interopRequireDefault(require("assert"));

var _path = _interopRequireDefault(require("path"));

var _createCompileService2 = require("./createCompileService.js");

var _url = require("url");

var _createHeaders = require("../openServer/createHeaders.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var projectRoot = _path.default.resolve(__dirname, "../../..");

var _createCompileService = (0, _createCompileService2.createCompileService)({
  rootLocation: projectRoot
}),
    service = _createCompileService.service;

service({
  method: "GET",
  url: new _url.URL("compiled/src/__test__/file.js", "file:///"),
  headers: (0, _createHeaders.createHeaders)({
    "user-agent": "node/8.0"
  })
}).then(function (properties) {
  _assert.default.equal(properties.status, 200);

  console.log("ok");
}); // service({
//   method: "GET",
//   url: new URL("compiled/src/__test__/file.js.map", "file:///"),
//   headers: createHeaders({
//     "user-agent": `node/8.0`,
//   }),
// }).then((properties) => {
//   assert.equal(properties.status, 200)
//   console.log("ok")
// })
//# sourceMappingURL=createCompileService.test.js.map