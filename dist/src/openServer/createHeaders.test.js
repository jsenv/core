"use strict";

var _test = require("@dmail/test");

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _createHeaders = require("./createHeaders.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

(0, _test.test)(function () {
  var headersPOJO = {
    "content-length": 10,
    foo: ["bar"]
  };
  var headers = (0, _createHeaders.createHeaders)(headersPOJO);

  _assert2["default"].equal(headers.has("content-length"), true);
  _assert2["default"].deepEqual(headers.toJSON(), headersPOJO);
  _assert2["default"].equal(headers.get("foo"), "bar");
});
//# sourceMappingURL=createHeaders.test.js.map