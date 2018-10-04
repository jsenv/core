"use strict";

var _composeGroups = require("./composeGroups.js");

var _assert = _interopRequireDefault(require("assert"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

{
  const firstGroup = {
    pluginNames: ["a"],
    compatMap: {
      chrome: 50,
      firefox: 20
    }
  };
  const secondGroup = {
    pluginNames: ["b", "e"],
    compatMap: {
      chrome: 49,
      firefox: 30,
      node: 10
    }
  };
  const actual = (0, _composeGroups.composeGroups)(firstGroup, secondGroup);
  const expected = {
    pluginNames: ["a", "b", "e"],
    compatMap: {
      chrome: "50",
      firefox: "30",
      node: "10"
    }
  };

  _assert.default.deepEqual(actual, expected);
}
console.log("passed");
//# sourceMappingURL=composeGroups.test.js.map