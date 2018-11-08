import { compatMap } from "@dmail/project-structure-compile-babel"
import { pluginCompatMapToPlatformGroups } from "./pluginCompatMapToPlatformGroups.js"
import assert from "assert"

{
  const actual = pluginCompatMapToPlatformGroups(
    {
      a: {
        chrome: 10,
      },
      b: {},
      c: {
        chrome: 9,
      },
    },
    "chrome",
  )
  const expected = [
    {
      pluginNames: ["a", "b", "c"],
      compatMap: {
        chrome: "0.0.0",
      },
    },
    {
      pluginNames: ["a", "b"],
      compatMap: {
        chrome: "9",
      },
    },
    {
      pluginNames: ["b"],
      compatMap: {
        chrome: "10",
      },
    },
  ]
  assert.deepEqual(actual, expected)
}

{
  const actual = pluginCompatMapToPlatformGroups(compatMap, "chrome")
  assert(actual.length > 0)
}

console.log("passed")
