import { assert } from "@dmail/assert"
import { envDescriptionToCompileMap } from "./envDescriptionToCompileMap.js"

{
  const babelPluginNameArray = ["transform-block-scoping"]
  const actual = envDescriptionToCompileMap({ babelPluginNameArray, compileGroupCount: 2 })
  const expected = {
    best: {
      babelPluginNameArray: [],
      compatMap: {
        chrome: "49",
        edge: "14",
        electron: "1",
        firefox: "51",
        ios: "10",
        node: "6",
        opera: "36",
        safari: "10",
      },
    },
    worst: {
      babelPluginNameArray: babelPluginNameArray.slice(),
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
      babelPluginNameArray: babelPluginNameArray.slice(),
      compatMap: {},
    },
  }
  assert({ actual, expected })
}

{
  const babelPluginNameArray = ["transform-block-scoping", "transform-modules-systemjs"]
  const actual = envDescriptionToCompileMap({ babelPluginNameArray })
  const expected = {
    best: {
      babelPluginNameArray: ["transform-modules-systemjs"],
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
      babelPluginNameArray: babelPluginNameArray.slice(),
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
      babelPluginNameArray: babelPluginNameArray.slice(),
      compatMap: {},
    },
  }
  assert({ actual, expected })
}
