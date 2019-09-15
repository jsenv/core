import { assert } from "@dmail/assert"
import { browserScoreMap, generateGroupMap } from "../../index.js"

{
  const babelPluginMap = {
    "transform-block-scoping": true,
    "transform-modules-systemjs": true,
  }
  const actual = generateGroupMap({
    babelPluginMap,
    platformScoreMap: browserScoreMap,
    groupCount: 2,
  })
  const expected = {
    best: {
      incompatibleNameArray: ["transform-modules-systemjs"],
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
      incompatibleNameArray: Object.keys(babelPluginMap),
      platformCompatMap: {},
    },
  }
  assert({ actual, expected })
}
