import { composePlatformGroups } from "./composePlatformGroups.js"
import assert from "assert"

{
  const chromePlatformGroups = [
    {
      // freeze to ensure mergePlatformGroups does not mutate
      pluginNames: Object.freeze(["a"]),
      compatMap: Object.freeze({
        chrome: 10,
      }),
    },
  ]
  const firefoxPlatformGroups = [
    {
      pluginNames: Object.freeze(["a"]),
      compatMap: Object.freeze({
        firefox: 20,
      }),
    },
  ]
  const actual = composePlatformGroups(chromePlatformGroups, firefoxPlatformGroups)
  const expected = [
    {
      pluginNames: ["a"],
      compatMap: {
        chrome: 10,
        firefox: 20,
      },
    },
  ]
  assert.deepEqual(actual, expected)
}

console.log("passed")
