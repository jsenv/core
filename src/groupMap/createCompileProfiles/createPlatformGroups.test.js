import { compatMap } from "@dmail/project-structure-compile-babel"
import { createPlatformGroups } from "./createPlatformGroups.js"
import assert from "assert"

{
  const actual = createPlatformGroups(
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
  const actual = createPlatformGroups(compatMap, "chrome")
  assert(actual.length > 0)
}

console.log("passed")
