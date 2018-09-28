"use strict";

var _test = require("@dmail/test");

var _assert = _interopRequireDefault(require("assert"));

var _nodeFetch = _interopRequireDefault(require("node-fetch"));

var _createNodeRequestHandler = require("./createNodeRequestHandler.js");

var _startServer = require("./startServer.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _test.test)(function () {
  return (0, _startServer.startServer)().then(function (_ref) {
    var addRequestHandler = _ref.addRequestHandler,
        url = _ref.url,
        agent = _ref.agent,
        close = _ref.close;
    var nodeRequestHandler = (0, _createNodeRequestHandler.createNodeRequestHandler)({
      handler: function handler() {
        // as we can see the whole concept behind createNodeRequestHandler
        // is to avoid using response methods directly but rather
        // return POJO that takes care of using response methods
        return {
          status: 200,
          headers: {
            "content-length": 2
          },
          body: "ok"
        };
      },
      url: url
    });
    addRequestHandler(nodeRequestHandler);
    return (0, _nodeFetch.default)(url, {
      agent: agent
    }).then(function (response) {
      return response.text();
    }).then(function (text) {
      _assert.default.equal(text, "ok");

      return close();
    });
  });
});
//# sourceMappingURL=createNodeRequestHandler.test.js.map