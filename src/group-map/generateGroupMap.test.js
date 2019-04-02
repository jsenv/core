import { assert } from "/node_modules/@dmail/assert/index.js"
import { generateGroupMap } from "./generateGroupMap.js"
import { browserScoreMap } from "./browserScoreMap.js"
import { nodeScoreMap } from "./nodeScoreMap.js"

{
  const babelConfigMap = { "transform-block-scoping": true }
  const actual = generateGroupMap({
    babelConfigMap,
    platformScoreMap: nodeScoreMap,
    groupCount: 2,
  })
  const expected = {
    best: { incompatibleNameArray: [], platformCompatibility: { node: "6" } },
    otherwise: {
      incompatibleNameArray: Object.keys(babelConfigMap),
      platformCompatibility: {},
    },
  }
  assert({ actual, expected })
}

{
  const babelConfigMap = { "transform-block-scoping": true }
  const actual = generateGroupMap({
    babelConfigMap,
    platformScoreMap: browserScoreMap,
    groupCount: 2,
  })
  const expected = {
    best: {
      incompatibleNameArray: [],
      platformCompatibility: {
        chrome: "49",
        firefox: "51",
        edge: "14",
        electron: "1",
        ios: "10",
        opera: "36",
        safari: "10",
      },
    },
    otherwise: {
      incompatibleNameArray: Object.keys(babelConfigMap),
      platformCompatibility: {},
    },
  }
  assert({ actual, expected })
}

{
  const babelConfigMap = {
    "transform-block-scoping": true,
    "transform-modules-systemjs": true,
  }
  const actual = generateGroupMap({
    babelConfigMap,
    platformScoreMap: browserScoreMap,
    groupCount: 2,
  })
  const expected = {
    best: {
      incompatibleNameArray: ["transform-modules-systemjs"],
      platformCompatibility: {
        chrome: "49",
        firefox: "51",
        edge: "14",
        electron: "1",
        ios: "10",
        opera: "36",
        safari: "10",
      },
    },
    otherwise: {
      incompatibleNameArray: Object.keys(babelConfigMap),
      platformCompatibility: {},
    },
  }
  assert({ actual, expected })
}

{
  const babelConfigMap = {
    "proposal-async-generator-functions": true,
    "proposal-object-rest-spread": true,
    "proposal-optional-catch-binding": true,
    "proposal-unicode-property-regex": true,
    "proposal-json-strings": true,
    "syntax-async-generators": true,
    "syntax-object-rest-spread": true,
    "syntax-optional-catch-binding": true,
    "transform-async-to-generator": true,
    "transform-arrow-functions": true,
    "transform-block-scoped-functions": true,
    "transform-block-scoping": true,
    "transform-classes": true,
    "transform-computed-properties": true,
    "transform-destructuring": true,
    "transform-dotall-regex": true,
    "transform-duplicate-keys": true,
    "transform-exponentiation-operator": true,
    "transform-for-of": true,
    "transform-function-name": true,
    "transform-literals": true,
    "transform-new-target": true,
    "transform-object-super": true,
    "transform-parameters": true,
    "transform-regenerator": true,
    "transform-shorthand-properties": true,
    "transform-spread": true,
    "transform-sticky-regex": true,
    "transform-template-literals": true,
    "transform-typeof-symbol": true,
    "transform-unicode-regex": true,
  }
  const actual = generateGroupMap({
    babelConfigMap,
    platformScoreMap: { ...browserScoreMap, ...nodeScoreMap },
    groupCount: 2,
  })
  const expected = {
    best: {
      incompatibleNameArray: [
        "proposal-async-generator-functions",
        "proposal-json-strings",
        "proposal-optional-catch-binding",
        "proposal-unicode-property-regex",
        "syntax-async-generators",
        "syntax-object-rest-spread",
        "syntax-optional-catch-binding",
        "transform-dotall-regex",
      ],
      platformCompatibility: {
        chrome: "60",
        firefox: "55",
        electron: "2",
        opera: "47",
        node: "8.3",
      },
    },
    otherwise: {
      incompatibleNameArray: Object.keys(babelConfigMap),
      platformCompatibility: {},
    },
  }
  assert({ actual, expected })
}
