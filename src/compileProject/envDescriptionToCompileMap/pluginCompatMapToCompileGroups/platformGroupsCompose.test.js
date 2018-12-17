import assert from "assert"
import { platformGroupsCompose } from "./platformGroupsCompose.js"

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
  const actual = platformGroupsCompose(chromePlatformGroups, firefoxPlatformGroups)
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
