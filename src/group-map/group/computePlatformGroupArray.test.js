import { assert } from "@dmail/assert"
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
      platformCompatMap: {
        chrome: "0.0.0",
      },
    },
    {
      incompatibleNameArray: ["a", "b"],
      platformCompatMap: {
        chrome: "9",
      },
    },
    {
      incompatibleNameArray: ["b"],
      platformCompatMap: {
        chrome: "10",
      },
    },
  ]
  assert({ actual, expected })
}
