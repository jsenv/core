import assert from "assert"
import { composeGroupArray } from "./composeGroupArray.js"

{
  const chromePlatformGroups = [
    {
      // freeze to ensure mergePlatformGroups does not mutate
      babelPluginNameArray: Object.freeze(["a"]),
      compatibility: Object.freeze({
        chrome: 10,
      }),
    },
  ]
  const firefoxPlatformGroups = [
    {
      babelPluginNameArray: Object.freeze(["a"]),
      compatibility: Object.freeze({
        firefox: 20,
      }),
    },
  ]
  const actual = composeGroupArray(chromePlatformGroups, firefoxPlatformGroups)
  const expected = [
    {
      babelPluginNameArray: ["a"],
      compatibility: {
        chrome: 10,
        firefox: 20,
      },
    },
  ]
  assert.deepEqual(actual, expected)
}

console.log("passed")
