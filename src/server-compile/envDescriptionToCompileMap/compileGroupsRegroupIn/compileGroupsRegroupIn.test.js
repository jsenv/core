import assert from "assert"
import { compileGroupsRegroupIn } from "./compileGroupsRegroupIn.js"

// const getScore = (a) => a.score

{
  const groups = [
    {
      pluginNames: ["b", "c"],
      compatMap: {
        chrome: 50,
        firefox: 10,
      },
      score: 2,
    },
    {
      pluginNames: ["b", "e"],
      compatMap: {
        chrome: 50,
        firefox: 11,
      },
      score: 1,
    },
    {
      pluginNames: ["a"],
      compatMap: {
        chrome: 50,
      },
      score: 0,
    },
  ]
  const actual = compileGroupsRegroupIn(groups, 2)
  const expected = [
    {
      pluginNames: ["b", "c"],
      compatMap: {
        chrome: "50",
        firefox: "10",
      },
    },
    {
      pluginNames: ["a", "b", "e"],
      compatMap: {
        chrome: "50",
        firefox: "11",
      },
    },
  ]
  assert.deepEqual(actual, expected)
}

console.log("passed")
