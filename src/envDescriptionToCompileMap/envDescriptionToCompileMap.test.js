import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap.js"
import assert from "assert"

{
  const pluginNames = ["transform-block-scoping", "transform-modules-systemjs"]
  const actual = envDescriptionToCompileMap({ pluginNames })
  const expected = {
    best: {
      pluginNames: ["transform-modules-systemjs"],
      compatMap: {
        chrome: "49",
        safari: "10",
        firefox: "51",
        edge: "14",
        opera: "36",
        ios: "10",
        node: "6",
        electron: "1",
      },
    },
    worst: {
      pluginNames,
      compatMap: {
        android: "0.0.0",
        chrome: "0.0.0",
        edge: "0.0.0",
        electron: "0.0.0",
        firefox: "0.0.0",
        ios: "0.0.0",
        node: "0.0.0",
        opera: "0.0.0",
        safari: "0.0.0",
      },
    },
    otherwise: {
      pluginNames,
      compatMap: {},
    },
  }
  assert.deepEqual(actual, expected)
}

console.log("passed")
