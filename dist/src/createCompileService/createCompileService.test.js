"use strict";

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _createCompileService2 = require("./createCompileService.js");

var _url = require("url");

var _createHeaders = require("../openServer/createHeaders.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var projectRoot = _path2["default"].resolve(__dirname, "../../..");

var _createCompileService = (0, _createCompileService2.createCompileService)({
  rootLocation: projectRoot
}),
    service = _createCompileService.service;

service({
  method: "GET",
  url: new _url.URL("compiled/src/__test__/file.js", "file:///"),
  headers: (0, _createHeaders.createHeaders)()
}).then(function (properties) {
  _assert2["default"].equal(properties.status, 200);
  console.log("ok");
});

service({
  method: "GET",
  url: new _url.URL("compiled/src/__test__/file.js.map", "file:///"),
  headers: (0, _createHeaders.createHeaders)()
}).then(function (properties) {
  _assert2["default"].equal(properties.status, 200);
  console.log("ok");
});
//# sourceMappingURL=createCompileService.test.js.map