"use strict";

const {
  splitGroups
} = require("./splitGroups.js");

const assert = require("assert");

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
  const actual = splitGroups(groups, getScore, 2);
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
  assert.deepEqual(actual, expected);
}
console.log("passed");
//# sourceMappingURL=splitGroups.test.js.map