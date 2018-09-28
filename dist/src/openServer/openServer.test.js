"use strict";

var _test = require("@dmail/test");

var _assert = _interopRequireDefault(require("assert"));

var _nodeFetch = _interopRequireDefault(require("node-fetch"));

var _openServer = require("./openServer.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _test.test)(function () {
  return (0, _openServer.openServer)({
    url: "http://127.0.0.1:8998"
  }).then(function (_ref) {
    var addRequestHandler = _ref.addRequestHandler,
        url = _ref.url,
        agent = _ref.agent,
        close = _ref.close;
    addRequestHandler(function () {
      return {
        status: 200,
        headers: {
          "Content-Type": "text/plain"
        },
        body: "ok"
      };
    });

    _assert.default.equal(String(url), "http://127.0.0.1:8998/");

    return (0, _nodeFetch.default)(url, {
      agent: agent
    }).then(function (response) {
      return response.text();
    }).then(function (text) {
      _assert.default.equal(text, "ok");

      return close();
    });
  });
}); // ici on testera que quand on kill le child à différent moment
// on obtient bien la réponse attendu coté client
// test(() => {
// 	return startServer({
// 		url: "http://localhost:0",
// 	}).then(({ nodeServer }) => {
// 		const { child } = isolateRequestHandler(nodeServer, (request, response) => {})
// 		child.kill()
// 	})
// })
//# sourceMappingURL=openServer.test.js.map