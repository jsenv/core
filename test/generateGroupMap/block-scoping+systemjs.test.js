import { assert } from "@jsenv/assert"
import { generateGroupMap } from "../../src/internal/generateGroupMap/generateGroupMap.js"
import { jsenvBrowserScoreMap } from "../../src/jsenvBrowserScoreMap.js"

{
  const babelPluginMap = {
    "transform-block-scoping": true,
    "transform-modules-systemjs": true,
  }
  const actual = generateGroupMap({
    babelPluginMap,
    platformScoreMap: jsenvBrowserScoreMap,
    groupCount: 2,
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: ["transform-modules-systemjs"],
      jsenvPluginRequiredNameArray: [],
      platformCompatMap: {
        chrome: "49",
        firefox: "51",
        edge: "14",
        electron: "1",
        ios: "11",
        opera: "36",
        safari: "11",
      },
    },
    otherwise: {
      babelPluginRequiredNameArray: Object.keys(babelPluginMap),
      jsenvPluginRequiredNameArray: [],
      platformCompatMap: {},
    },
  }
  assert({ actual, expected })
}
