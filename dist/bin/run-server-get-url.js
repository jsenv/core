"use strict";

var _runServer = require("./run-server.js");

(0, _runServer.open)({
  root: ""
}).then(function (_ref) {
  var runServerURL = _ref.runServerURL;

  debugger;
  process.env.RUN_SERVER_URL = runServerURL.toString();
});
//# sourceMappingURL=run-server-get-url.js.map