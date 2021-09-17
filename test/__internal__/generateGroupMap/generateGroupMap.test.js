import { assert } from "@jsenv/assert"

import { jsenvBabelPluginMap } from "@jsenv/core"
import {
  generateGroupMap,
  withoutSyntaxPlugins,
} from "@jsenv/core/src/internal/generateGroupMap/generateGroupMap.js"
import {
  jsenvBrowserScoreMap,
  jsenvNodeVersionScoreMap,
} from "@jsenv/core/src/internal/generateGroupMap/jsenvRuntimeScoreMap.js"

{
  const babelPluginMap = { "transform-block-scoping": true }
  const actual = generateGroupMap({
    babelPluginMap,
    runtimeSupport: {
      node: "0.0.0",
    },
    runtimeScoreMap: {
      node: jsenvNodeVersionScoreMap,
    },
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
    runtimeSupport: {
      chrome: "0.0.0",
      firefox: "0.0.0",
      edge: "0.0.0",
      electron: "0.0.0",
      ios: "0.0.0",
      opera: "0.0.0",
      safari: "0.0.0",
    },
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
    runtimeSupport: {
      chrome: "0.0.0",
      firefox: "0.0.0",
      edge: "0.0.0",
      electron: "0.0.0",
      ios: "0.0.0",
      opera: "0.0.0",
      safari: "0.0.0",
    },
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
    runtimeSupport: {
      chrome: "0.0.0",
      firefox: "0.0.0",
      edge: "0.0.0",
      electron: "0.0.0",
      ios: "0.0.0",
      opera: "0.0.0",
      safari: "0.0.0",
      node: "0.0.0",
    },
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
        chrome: "75",
        firefox: "70",
        edge: "79",
        electron: "6",
        opera: "62",
        safari: "13",
        node: "12.5",
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
