"use strict";

var _test = require("@dmail/test");

var _assert = _interopRequireDefault(require("assert"));

var _nodeFetch = _interopRequireDefault(require("node-fetch"));

var _createNodeRequestHandler = require("./createNodeRequestHandler.js");

var _startServer = require("./startServer.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _test.test)(() => {
  return (0, _startServer.startServer)().then(({
    addRequestHandler,
    url,
    agent,
    close
  }) => {
    const nodeRequestHandler = (0, _createNodeRequestHandler.createNodeRequestHandler)({
      handler: () => {
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
      url
    });
    addRequestHandler(nodeRequestHandler);
    return (0, _nodeFetch.default)(url, {
      agent
    }).then(response => response.text()).then(text => {
      _assert.default.equal(text, "ok");

      return close();
    });
  });
});
//# sourceMappingURL=createNodeRequestHandler.test.js.map