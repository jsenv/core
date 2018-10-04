"use strict";

var _splitGroups = require("./splitGroups.js");

var _assert = _interopRequireDefault(require("assert"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const getScore = a => a.score;

{
  const groups = [{
    pluginNames: ["a"],
    compatMap: {
      chrome: 50
    },
    score: 0
  }, {
    pluginNames: ["b", "e"],
    compatMap: {
      chrome: 50,
      firefox: 11
    },
    score: 1
  }, {
    pluginNames: ["b", "c"],
    compatMap: {
      chrome: 50,
      firefox: 10
    },
    score: 2
  }];
  const actual = (0, _splitGroups.splitGroups)(groups, getScore, 2);
  const expected = [{
    pluginNames: ["b", "c"],
    compatMap: {
      chrome: "50",
      firefox: "10"
    }
  }, {
    pluginNames: ["a", "b", "e"],
    compatMap: {
      chrome: "50",
      firefox: "11"
    }
  }];

  _assert.default.deepEqual(actual, expected);
}
console.log("passed");
//# sourceMappingURL=splitGroups.test.js.map