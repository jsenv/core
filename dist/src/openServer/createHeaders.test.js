"use strict";

var _test = require("@dmail/test");

var _assert = _interopRequireDefault(require("assert"));

var _createHeaders = require("./createHeaders.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _test.test)(function () {
  var headersPOJO = {
    "content-length": 10,
    foo: ["bar"]
  };
  var headers = (0, _createHeaders.createHeaders)(headersPOJO);

  _assert.default.equal(headers.has("content-length"), true);

  _assert.default.deepEqual(headers.toJSON(), headersPOJO);

  _assert.default.equal(headers.get("foo"), "bar");
});
//# sourceMappingURL=createHeaders.test.js.map