import assert from "assert"
import { babelPluginCompatibilityDescription } from "../babelPluginCompatibilityDescription.js"
import { compatibilityDescriptionToGroupArrayForPlatform } from "./compatibilityDescriptionToGroupArrayForPlatform.js"

{
  const actual = compatibilityDescriptionToGroupArrayForPlatform(
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
  const actual = compatibilityDescriptionToGroupArrayForPlatform(
    babelPluginCompatibilityDescription,
    "chrome",
  )
  assert(actual.length > 0)
}
