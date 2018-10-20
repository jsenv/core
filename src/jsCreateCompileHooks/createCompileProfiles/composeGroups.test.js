import { composeGroups } from "./composeGroups.js"
import assert from "assert"

{
  const firstGroup = {
    pluginNames: ["a"],
    compatMap: {
      chrome: 50,
      firefox: 20,
    },
  }
  const secondGroup = {
    pluginNames: ["b", "e"],
    compatMap: {
      chrome: 49,
      firefox: 30,
      node: 10,
    },
  }
  const actual = composeGroups(firstGroup, secondGroup)
  const expected = {
    pluginNames: ["a", "b", "e"],
    compatMap: {
      chrome: "50",
      firefox: "30",
      node: "10",
    },
  }
  assert.deepEqual(actual, expected)
}

console.log("passed")
