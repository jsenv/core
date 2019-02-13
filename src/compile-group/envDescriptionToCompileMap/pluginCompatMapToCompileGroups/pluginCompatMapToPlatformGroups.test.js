import assert from "assert"
import { compatMap } from "@dmail/project-structure-compile-babel"
import { pluginCompatMapToPlatformGroups } from "./pluginCompatMapToPlatformGroups.js"

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
      babelPluginNameArray: ["a", "b", "c"],
      compatMap: {
        chrome: "0.0.0",
      },
    },
    {
      babelPluginNameArray: ["a", "b"],
      compatMap: {
        chrome: "9",
      },
    },
    {
      babelPluginNameArray: ["b"],
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
