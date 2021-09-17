import { assert } from "@jsenv/assert"

import { jsenvBabelPluginMap } from "@jsenv/core"
import {
  generateGroupMap,
  withoutSyntaxPlugins,
} from "@jsenv/core/src/internal/generateGroupMap/generateGroupMap.js"

{
  const actual = generateGroupMap({
    babelPluginMap: {
      "transform-block-scoping": true,
    },
    runtimeSupport: {
      node: "0.0.0",
    },
    compileGroupCount: 1,
    runtimeSupportIsExhaustive: true,
    runtimeWillAlwaysBeKnown: true,
  })
  const expected = {
    otherwise: {
      babelPluginRequiredNameArray: ["transform-block-scoping"],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {
        node: "0.0.0",
      },
    },
  }
  assert({ actual, expected })
}

{
  const actual = generateGroupMap({
    babelPluginMap: {
      "transform-block-scoping": true,
    },
    runtimeSupport: {
      node: "0.0.0",
    },
    compileGroupCount: 2,
    runtimeSupportIsExhaustive: true,
    runtimeWillAlwaysBeKnown: true,
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: [],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: { node: "6" },
    },
    worst: {
      babelPluginRequiredNameArray: ["transform-block-scoping"],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {
        node: "0.0.0",
      },
    },
  }
  assert({ actual, expected })
}

{
  const actual = generateGroupMap({
    babelPluginMap: {
      "transform-block-scoping": true,
      "transform-modules-systemjs": true,
    },
    runtimeSupport: {
      node: "7.0.0",
    },
    compileGroupCount: 2,
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: ["transform-modules-systemjs"],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: { node: "6" },
    },
    otherwise: {
      babelPluginRequiredNameArray: [
        "transform-block-scoping",
        "transform-modules-systemjs",
      ],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {},
    },
  }
  assert({ actual, expected })
}

{
  const actual = generateGroupMap({
    babelPluginMap: {
      "transform-block-scoping": true,
    },
    runtimeSupport: {
      chrome: "0.0.0",
      firefox: "0.0.0",
      edge: "0.0.0",
      electron: "0.0.0",
      ios: "0.0.0",
      opera: "0.0.0",
      safari: "0.0.0",
    },
    compileGroupCount: 2,
    runtimeSupportIsExhaustive: true,
    runtimeWillAlwaysBeKnown: true,
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
    worst: {
      babelPluginRequiredNameArray: ["transform-block-scoping"],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {
        chrome: "0.0.0",
        edge: "0.0.0",
        electron: "0.0.0",
        firefox: "0.0.0",
        ios: "0.0.0",
        opera: "0.0.0",
        safari: "0.0.0",
      },
    },
  }
  assert({ actual, expected })
}

{
  const actual = generateGroupMap({
    babelPluginMap: {
      "transform-block-scoping": true,
      "transform-modules-systemjs": true,
    },
    runtimeSupport: {
      chrome: "0.0.0",
      firefox: "0.0.0",
      edge: "0.0.0",
      electron: "0.0.0",
      ios: "0.0.0",
      opera: "0.0.0",
      safari: "0.0.0",
    },
    compileGroupCount: 2,
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: ["transform-modules-systemjs"],
      jsenvPluginRequiredNameArray: [],
      runtimeCompatMap: {
        chrome: "49",
        edge: "14",
        electron: "0.37",
        firefox: "51",
        ios: "11",
        opera: "36",
        safari: "11",
      },
    },
    otherwise: {
      babelPluginRequiredNameArray: [
        "transform-block-scoping",
        "transform-modules-systemjs",
      ],
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
    compileGroupCount: 1,
    runtimeSupportIsExhaustive: true,
    runtimeWillAlwaysBeKnown: true,
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
