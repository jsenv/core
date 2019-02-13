import assert from "assert"
import { decreaseArrayByComposingValues } from "./decreaseArrayByComposingValues.js"

// const getScore = (a) => a.score

{
  const groups = [
    {
      babelPluginNameArray: ["b", "c"],
      compatibilityDescription: {
        chrome: 50,
        firefox: 10,
      },
      score: 2,
    },
    {
      babelPluginNameArray: ["b", "e"],
      compatibilityDescription: {
        chrome: 50,
        firefox: 11,
      },
      score: 1,
    },
    {
      babelPluginNameArray: ["a"],
      compatibilityDescription: {
        chrome: 50,
      },
      score: 0,
    },
  ]
  const actual = decreaseArrayByComposingValues(groups, 2)
  const expected = [
    {
      babelPluginNameArray: ["b", "c"],
      compatibilityDescription: {
        chrome: "50",
        firefox: "10",
      },
    },
    {
      babelPluginNameArray: ["a", "b", "e"],
      compatibilityDescription: {
        chrome: "50",
        firefox: "11",
      },
    },
  ]
  assert.deepEqual(actual, expected)
}

console.log("passed")
