"use strict";

var _composePlatformGroups = require("./composePlatformGroups.js");

var _assert = _interopRequireDefault(require("assert"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

{
  const chromePlatformGroups = [{
    // freeze to ensure mergePlatformGroups does not mutate
    pluginNames: Object.freeze(["a"]),
    compatMap: Object.freeze({
      chrome: 10
    })
  }];
  const firefoxPlatformGroups = [{
    pluginNames: Object.freeze(["a"]),
    compatMap: Object.freeze({
      firefox: 20
    })
  }];
  const actual = (0, _composePlatformGroups.composePlatformGroups)(chromePlatformGroups, firefoxPlatformGroups);
  const expected = [{
    pluginNames: ["a"],
    compatMap: {
      chrome: 10,
      firefox: 20
    }
  }];

  _assert.default.deepEqual(actual, expected);
}
console.log("passed");
//# sourceMappingURL=composePlatformGroups.test.js.map