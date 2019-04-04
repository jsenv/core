import { assert } from "/node_modules/@dmail/assert/index.js"
import { composeGroupArray } from "./composeGroupArray.js"

{
  const chromePlatformGroups = [
    {
      // freeze to ensure composeGroupArray does not mutate
      incompatibleNameArray: Object.freeze(["a"]),
      platformCompatMap: Object.freeze({
        chrome: 10,
      }),
    },
  ]
  const firefoxPlatformGroups = [
    {
      incompatibleNameArray: Object.freeze(["a"]),
      platformCompatMap: Object.freeze({
        firefox: 20,
      }),
    },
  ]
  const actual = composeGroupArray(chromePlatformGroups, firefoxPlatformGroups)
  const expected = [
    {
      incompatibleNameArray: ["a"],
      platformCompatMap: {
        chrome: "10",
        firefox: "20",
      },
    },
  ]
  assert({ actual, expected })
}
