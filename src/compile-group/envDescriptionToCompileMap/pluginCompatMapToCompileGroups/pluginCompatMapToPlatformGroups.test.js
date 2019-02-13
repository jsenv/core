import assert from "assert"
import { compatibilityDescription } from "@dmail/project-structure-compile-babel"
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
      compatibilityDescription: {
        chrome: "0.0.0",
      },
    },
    {
      babelPluginNameArray: ["a", "b"],
      compatibilityDescription: {
        chrome: "9",
      },
    },
    {
      babelPluginNameArray: ["b"],
      compatibilityDescription: {
        chrome: "10",
      },
    },
  ]
  assert.deepEqual(actual, expected)
}

{
  const actual = pluginCompatMapToPlatformGroups(compatibilityDescription, "chrome")
  assert(actual.length > 0)
}

console.log("passed")
