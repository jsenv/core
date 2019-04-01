import { assert } from "/node_modules/@dmail/assert/index.js"
import { computePlatformGroupArray } from "./computePlatformGroupArray.js"

{
  const actual = computePlatformGroupArray({
    compatibilityDescription: {
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
      compatibility: {
        chrome: "0.0.0",
      },
    },
    {
      incompatibleNameArray: ["a", "b"],
      compatibility: {
        chrome: "9",
      },
    },
    {
      incompatibleNameArray: ["b"],
      compatibility: {
        chrome: "10",
      },
    },
  ]
  assert({ actual, expected })
}
