import assert from "assert"
import { composeGroup } from "./composeGroup.js"

{
  const firstGroup = {
    babelPluginNameArray: ["a"],
    compatibility: {
      chrome: 50,
      firefox: 20,
    },
  }
  const secondGroup = {
    babelPluginNameArray: ["b", "e"],
    compatibility: {
      chrome: 49,
      firefox: 30,
      node: 10,
    },
  }
  const actual = composeGroup(firstGroup, secondGroup)
  const expected = {
    babelPluginNameArray: ["a", "b", "e"],
    compatibilityDescription: {
      chrome: "50",
      firefox: "30",
      node: "10",
    },
  }
  assert.deepEqual(actual, expected)
}

console.log("passed")
