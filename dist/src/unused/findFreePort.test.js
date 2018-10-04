"use strict";

var _test = require("@dmail/test");

var _assert = _interopRequireDefault(require("assert"));

var _findFreePort = require("./findFreePort.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _test.test)(() => {
  return (0, _findFreePort.findFreePort)().then(port => {
    _assert.default.equal(typeof port, "number");
  });
});
//# sourceMappingURL=findFreePort.test.js.map