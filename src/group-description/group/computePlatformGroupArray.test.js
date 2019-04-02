import { assert } from "/node_modules/@dmail/assert/index.js"
import { computePlatformGroupArray } from "./computePlatformGroupArray.js"

{
  const actual = computePlatformGroupArray({
    featureCompatMap: {
      a: {
        chrome: 10,
      },
      b: {},
      c: {
        chrome: 9,
      },
    },
    platformName: "chrome",
  })
  const expected = [
    {
      incompatibleNameArray: ["a", "b", "c"],
      platformCompatibility: {
        chrome: "0.0.0",
      },
    },
    {
      incompatibleNameArray: ["a", "b"],
      platformCompatibility: {
        chrome: "9",
      },
    },
    {
      incompatibleNameArray: ["b"],
      platformCompatibility: {
        chrome: "10",
      },
    },
  ]
  assert({ actual, expected })
}
