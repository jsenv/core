import assert from "assert"
import { platformGroupsCompose } from "./platformGroupsCompose.js"

{
  const chromePlatformGroups = [
    {
      // freeze to ensure mergePlatformGroups does not mutate
      babelPluginNameArray: Object.freeze(["a"]),
      compatMap: Object.freeze({
        chrome: 10,
      }),
    },
  ]
  const firefoxPlatformGroups = [
    {
      babelPluginNameArray: Object.freeze(["a"]),
      compatMap: Object.freeze({
        firefox: 20,
      }),
    },
  ]
  const actual = platformGroupsCompose(chromePlatformGroups, firefoxPlatformGroups)
  const expected = [
    {
      babelPluginNameArray: ["a"],
      compatMap: {
        chrome: 10,
        firefox: 20,
      },
    },
  ]
  assert.deepEqual(actual, expected)
}

console.log("passed")
