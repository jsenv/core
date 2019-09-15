import { assert } from "@dmail/assert"
import { browserScoreMap, nodeVersionScoreMap, generateGroupMap } from "../../index.js"

{
  const babelPluginMap = { "transform-block-scoping": true }
  const actual = generateGroupMap({
    babelPluginMap,
    platformScoreMap: { node: nodeVersionScoreMap },
    groupCount: 2,
  })
  const expected = {
    best: { incompatibleNameArray: [], platformCompatMap: { node: "6" } },
    otherwise: {
      incompatibleNameArray: Object.keys(babelPluginMap),
      platformCompatMap: {},
    },
  }
  assert({ actual, expected })
}

{
  const babelPluginMap = { "transform-block-scoping": true }
  const actual = generateGroupMap({
    babelPluginMap,
    platformScoreMap: browserScoreMap,
    groupCount: 2,
  })
  const expected = {
    best: {
      incompatibleNameArray: [],
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
