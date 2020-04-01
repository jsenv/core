import { assert } from "@jsenv/assert"
import { generateGroupMap } from "../../src/internal/generateGroupMap/generateGroupMap.js"
import { jsenvBrowserScoreMap } from "../../src/jsenvBrowserScoreMap.js"
import { jsenvNodeVersionScoreMap } from "../../src/jsenvNodeVersionScoreMap.js"
import { jsenvBabelPluginMap } from "../../index.js"

{
  const babelPluginMap = { "transform-block-scoping": true }
  const actual = generateGroupMap({
    babelPluginMap,
    runtimeScoreMap: { node: jsenvNodeVersionScoreMap },
    groupCount: 2,
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: [],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: { node: "6" },
    },
    otherwise: {
      babelPluginRequiredNameArray: Object.keys(babelPluginMap),
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {},
    },
  }
  assert({ actual, expected })
}

{
  const babelPluginMap = { "transform-block-scoping": true }
  const actual = generateGroupMap({
    babelPluginMap,
    runtimeScoreMap: jsenvBrowserScoreMap,
    groupCount: 2,
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: [],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {
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
      runtimeCompatMap: {},
    },
  }
  assert({ actual, expected })
}

{
  const babelPluginMap = {
    "transform-block-scoping": true,
    "transform-modules-systemjs": true,
  }
  const actual = generateGroupMap({
    babelPluginMap,
    runtimeScoreMap: jsenvBrowserScoreMap,
    groupCount: 2,
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: ["transform-modules-systemjs"],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {
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
      runtimeCompatMap: {},
    },
  }
  assert({ actual, expected })
}

{
  const actual = generateGroupMap({
    babelPluginMap: jsenvBabelPluginMap,
    runtimeScoreMap: { ...jsenvBrowserScoreMap, node: jsenvNodeVersionScoreMap },
    groupCount: 2,
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: [
        "proposal-json-strings",
        "proposal-numeric-separator",
        "proposal-optional-catch-binding",
        "proposal-optional-chaining",
        "proposal-unicode-property-regex",
        "syntax-object-rest-spread",
        "syntax-optional-catch-binding",
        "transform-dotall-regex",
      ],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {
        chrome: "60",
        firefox: "55",
        electron: "2.1",
        opera: "47",
        node: "8.3",
      },
    },
    otherwise: {
      babelPluginRequiredNameArray: Object.keys(jsenvBabelPluginMap),
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {},
    },
  }
  assert({ actual, expected })
}
