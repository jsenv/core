import { getCompatGroupMap } from "./getCompatGroupMap.js"
import assert from "assert"

{
  const pluginNames = ["transform-modules-systemjs"]
  const group = getCompatGroupMap({ pluginNames })
  const actual = group.otherwise.pluginNames
  assert.deepEqual(actual, ["transform-modules-systemjs"])
}

console.log("passed")
