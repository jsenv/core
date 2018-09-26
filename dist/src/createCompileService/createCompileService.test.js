"use strict";

var _assert = _interopRequireDefault(require("assert"));

var _path = _interopRequireDefault(require("path"));

var _createCompileService = require("./createCompileService.js");

var _url = require("url");

var _createHeaders = require("../openServer/createHeaders.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const projectRoot = _path.default.resolve(__dirname, "../../..");

const {
  service
} = (0, _createCompileService.createCompileService)({
  rootLocation: projectRoot
});
service({
  method: "GET",
  url: new _url.URL("compiled/src/__test__/file.js", "file:///"),
  headers: (0, _createHeaders.createHeaders)()
}).then(properties => {
  _assert.default.equal(properties.status, 200);

  console.log("ok");
});
service({
  method: "GET",
  url: new _url.URL("compiled/src/__test__/file.js.map", "file:///"),
  headers: (0, _createHeaders.createHeaders)()
}).then(properties => {
  _assert.default.equal(properties.status, 200);

  console.log("ok");
});
//# sourceMappingURL=createCompileService.test.js.map