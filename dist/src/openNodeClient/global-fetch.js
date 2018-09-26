"use strict";

var _https = _interopRequireDefault(require("https"));

var _nodeFetch = _interopRequireDefault(require("node-fetch"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_https.default.globalAgent.options.rejectUnauthorized = false;
global.fetch = _nodeFetch.default;
//# sourceMappingURL=global-fetch.js.map