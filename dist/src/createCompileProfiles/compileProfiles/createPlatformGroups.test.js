"use strict";

var _projectStructureCompileBabel = require("@dmail/project-structure-compile-babel");

var _createPlatformGroups = require("./createPlatformGroups.js");

var _assert = _interopRequireDefault(require("assert"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

{
  const actual = (0, _createPlatformGroups.createPlatformGroups)({
    a: {
      chrome: 10
    },
    b: {},
    c: {
      chrome: 9
    }
  }, "chrome");
  const expected = [{
    pluginNames: ["a", "b", "c"],
    compatMap: {
      chrome: "0.0.0"
    }
  }, {
    pluginNames: ["a", "b"],
    compatMap: {
      chrome: "9"
    }
  }, {
    pluginNames: ["b"],
    compatMap: {
      chrome: "10"
    }
  }];

  _assert.default.deepEqual(actual, expected);
}
{
  const actual = (0, _createPlatformGroups.createPlatformGroups)(_projectStructureCompileBabel.compatMapBabel, "chrome");
  (0, _assert.default)(actual.length > 0);
}
console.log("passed");
//# sourceMappingURL=createPlatformGroups.test.js.map