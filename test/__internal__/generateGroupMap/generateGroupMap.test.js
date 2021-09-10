import { assert } from "@jsenv/assert"

import { jsenvBabelPluginMap } from "@jsenv/core"
import {
  generateGroupMap,
  withoutSyntaxPlugins,
} from "@jsenv/core/src/internal/generateGroupMap/generateGroupMap.js"
import { jsenvBrowserScoreMap } from "@jsenv/core/src/jsenvBrowserScoreMap.js"
import { jsenvNodeVersionScoreMap } from "@jsenv/core/src/jsenvNodeVersionScoreMap.js"

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
        electron: "0.37",
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
        electron: "0.37",
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
    runtimeScoreMap: {
      ...jsenvBrowserScoreMap,
      node: jsenvNodeVersionScoreMap,
    },
    groupCount: 2,
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: [],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {
        chrome: "80",
        firefox: "78",
        edge: "80",
        electron: "8.1",
        opera: "67",
        safari: "13.1",
        node: "14",
      },
    },
    otherwise: {
      babelPluginRequiredNameArray: Object.keys(
        withoutSyntaxPlugins(jsenvBabelPluginMap),
      ),
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {},
    },
  }
  assert({ actual, expected })
}
