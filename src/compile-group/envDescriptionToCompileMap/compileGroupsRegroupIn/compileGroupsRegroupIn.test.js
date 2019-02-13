import assert from "assert"
import { compileGroupsRegroupIn } from "./compileGroupsRegroupIn.js"

// const getScore = (a) => a.score

{
  const groups = [
    {
      babelPluginNameArray: ["b", "c"],
      compatMap: {
        chrome: 50,
        firefox: 10,
      },
      score: 2,
    },
    {
      babelPluginNameArray: ["b", "e"],
      compatMap: {
        chrome: 50,
        firefox: 11,
      },
      score: 1,
    },
    {
      babelPluginNameArray: ["a"],
      compatMap: {
        chrome: 50,
      },
      score: 0,
    },
  ]
  const actual = compileGroupsRegroupIn(groups, 2)
  const expected = [
    {
      babelPluginNameArray: ["b", "c"],
      compatMap: {
        chrome: "50",
        firefox: "10",
      },
    },
    {
      babelPluginNameArray: ["a", "b", "e"],
      compatMap: {
        chrome: "50",
        firefox: "11",
      },
    },
  ]
  assert.deepEqual(actual, expected)
}

console.log("passed")
