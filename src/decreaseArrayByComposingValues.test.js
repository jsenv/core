import { assert } from "/node_modules/@dmail/assert/index.js"
import { decreaseArrayByComposingValues } from "./decreaseArrayByComposingValues.js"

// const getScore = (a) => a.score

{
  const groups = [
    {
      incompatibleNameArray: ["b", "c"],
      platformCompatibility: {
        chrome: 50,
        firefox: 10,
      },
      score: 2,
    },
    {
      incompatibleNameArray: ["b", "e"],
      platformCompatibility: {
        chrome: 50,
        firefox: 11,
      },
      score: 1,
    },
    {
      incompatibleNameArray: ["a"],
      platformCompatibility: {
        chrome: 50,
      },
      score: 0,
    },
  ]
  const actual = decreaseArrayByComposingValues(groups, 2)
  const expected = [
    {
      incompatibleNameArray: ["b", "c"],
      platformCompatibility: {
        chrome: "50",
        firefox: "10",
      },
    },
    {
      incompatibleNameArray: ["a", "b", "e"],
      platformCompatibility: {
        chrome: "50",
        firefox: "11",
      },
    },
  ]
  assert({ actual, expected })
}
