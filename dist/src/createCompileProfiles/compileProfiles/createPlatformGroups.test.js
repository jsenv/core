"use strict";

const {
  createPlatformGroups,
  compatMapBabel
} = require("./createPlatformGroups.js");

const assert = require("assert");

{
  const actual = createPlatformGroups({
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
  assert.deepEqual(actual, expected);
}
{
  const actual = createPlatformGroups(compatMapBabel, "chrome");
  assert(actual.length > 0);
}
console.log("passed");
//# sourceMappingURL=createPlatformGroups.test.js.map