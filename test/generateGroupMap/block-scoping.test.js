import { assert } from "@dmail/assert"
import { generateGroupMap } from "../../src/private/generateGroupMap/generateGroupMap.js"
import { browserScoreMap } from "../../src/browserScoreMap.js"
import { nodeVersionScoreMap } from "../../src/nodeVersionScoreMap.js"

{
  const babelPluginMap = { "transform-block-scoping": true }
  const actual = generateGroupMap({
    babelPluginMap,
    platformScoreMap: { node: nodeVersionScoreMap },
    groupCount: 2,
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: [],
      jsenvPluginRequiredNameArray: [],
      platformCompatMap: { node: "6" },
    },
    otherwise: {
      babelPluginRequiredNameArray: Object.keys(babelPluginMap),
      jsenvPluginRequiredNameArray: [],
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
      babelPluginRequiredNameArray: [],
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
