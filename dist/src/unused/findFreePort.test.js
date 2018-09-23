"use strict";

var _test = require("@dmail/test");

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _findFreePort = require("./findFreePort.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

(0, _test.test)(function () {
  return (0, _findFreePort.findFreePort)().then(function (port) {
    _assert2["default"].equal(typeof port, "number");
  });
});
//# sourceMappingURL=findFreePort.test.js.map