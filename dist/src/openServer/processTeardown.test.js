"use strict";

var _test = require("@dmail/test");

var _processTeardown = require("./processTeardown.js");

(0, _test.test)(function () {
  (0, _processTeardown.processTeardown)(function (reason) {
    console.log(reason);
  });
});
//# sourceMappingURL=processTeardown.test.js.map