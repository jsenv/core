import { compileGroupsRegroupIn } from "./compileGroupsRegroupIn.js"
import assert from "assert"

// const getScore = (a) => a.score

{
  const groups = [
    {
      pluginNames: ["a"],
      platformCompatMap: {
        chrome: 50,
      },
      score: 0,
    },
    {
      pluginNames: ["b", "e"],
      platformCompatMap: {
        chrome: 50,
        firefox: 11,
      },
      score: 1,
    },
    {
      pluginNames: ["b", "c"],
      platformCompatMap: {
        chrome: 50,
        firefox: 10,
      },
      score: 2,
    },
  ]
  const actual = compileGroupsRegroupIn(groups, 2)
  const expected = [
    {
      pluginNames: ["b", "c"],
      platformCompatMap: {
        chrome: "50",
        firefox: "10",
      },
    },
    {
      pluginNames: ["a", "b", "e"],
      platformCompatMap: {
        chrome: "50",
        firefox: "11",
      },
    },
  ]
  assert.deepEqual(actual, expected)
}

console.log("passed")
