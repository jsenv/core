"use strict";

var _https = require("https");

var _https2 = _interopRequireDefault(_https);

var _nodeFetch = require("node-fetch");

var _nodeFetch2 = _interopRequireDefault(_nodeFetch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

_https2["default"].globalAgent.options.rejectUnauthorized = false;

global.fetch = _nodeFetch2["default"];
//# sourceMappingURL=global-fetch.js.map