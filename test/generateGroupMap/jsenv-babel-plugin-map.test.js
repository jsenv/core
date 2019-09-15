import { assert } from "@dmail/assert"
import { browserScoreMap, nodeVersionScoreMap, generateGroupMap } from "../../index.js"

const { jsenvBabelPluginMap } = import.meta.require("@jsenv/babel-plugin-map")

{
  const actual = generateGroupMap({
    babelPluginMap: jsenvBabelPluginMap,
    platformScoreMap: { ...browserScoreMap, node: nodeVersionScoreMap },
    groupCount: 2,
  })
  const expected = {
    best: {
      incompatibleNameArray: [
        "proposal-json-strings",
        "proposal-optional-catch-binding",
        "proposal-unicode-property-regex",
        "syntax-object-rest-spread",
        "syntax-optional-catch-binding",
        "transform-dotall-regex",
      ],
      platformCompatMap: {
        chrome: "60",
        firefox: "55",
        electron: "2.1",
        opera: "47",
        node: "8.3",
      },
    },
    otherwise: {
      incompatibleNameArray: Object.keys(jsenvBabelPluginMap),
      platformCompatMap: {},
    },
  }
  assert({ actual, expected })
}
