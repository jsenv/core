import { assert } from "@dmail/assert"
import { generateGroupDescription } from "./generateGroupDescription.js"
import { browserScoring } from "./browserScoring.js"

{
  const babelPluginDescription = { "transform-block-scoping": [] }
  const actual = generateGroupDescription({
    babelPluginDescription,
    platformScoring: browserScoring,
    groupCount: 2,
  })
  const expected = {
    best: {
      babelPluginNameArray: [],
      compatibility: {
        chrome: "49",
        edge: "14",
        electron: "1",
        firefox: "51",
        ios: "10",
        opera: "36",
        safari: "10",
      },
    },
    otherwise: {
      babelPluginNameArray: Object.keys(babelPluginDescription),
      compatibility: {},
    },
  }
  assert({ actual, expected })
}

{
  const babelPluginDescription = {
    "transform-block-scoping": true,
    "transform-modules-systemjs": true,
  }
  const actual = generateGroupDescription({
    babelPluginDescription,
    platformScoring: browserScoring,
    groupCount: 2,
  })
  const expected = {
    best: {
      babelPluginNameArray: ["transform-modules-systemjs"],
      compatibility: {
        chrome: "49",
        edge: "14",
        electron: "1",
        firefox: "51",
        ios: "10",
        opera: "36",
        safari: "10",
      },
    },
    otherwise: {
      babelPluginNameArray: Object.keys(babelPluginDescription),
      compatibility: {},
    },
  }
  assert({ actual, expected })
}
