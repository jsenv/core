import { assert } from "@jsenv/assert"

import { jsenvBabelPluginMap } from "@jsenv/core"
import { generateGroupMap } from "@jsenv/core/src/internal/generateGroupMap/generateGroupMap.js"

// supporting all node versions ("0.0.0")
{
  const actual = generateGroupMap({
    babelPluginMap: {
      "transform-block-scoping": true,
    },
    runtimeSupport: {
      node: "0.0.0",
    },
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: ["transform-block-scoping"],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {
        node: "0.0.0",
      },
    },
    otherwise: {
      babelPluginRequiredNameArray: ["transform-block-scoping"],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// supporting node 14.17
{
  const actual = generateGroupMap({
    babelPluginMap: {
      "transform-block-scoping": true,
    },
    runtimeSupport: {
      node: "14.17",
    },
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: [],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: { node: "6" },
    },
    otherwise: {
      babelPluginRequiredNameArray: ["transform-block-scoping"],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// supporting chrome and firefox
{
  const actual = generateGroupMap({
    babelPluginMap: {
      "transform-block-scoping": true,
      "transform-modules-systemjs": true,
    },
    runtimeSupport: {
      chrome: "60",
      firefox: "51",
    },
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: ["transform-modules-systemjs"],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {
        chrome: "49",
        firefox: "51",
      },
    },
    otherwise: {
      babelPluginRequiredNameArray: [
        "transform-block-scoping",
        "transform-modules-systemjs",
      ],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// supporting chrome + firefox + webkit
{
  const actual = generateGroupMap({
    babelPluginMap: {
      "transform-block-scoping": true,
    },
    runtimeSupport: {
      chrome: "49",
      firefox: "51.0.0",
      safari: "12.0.0",
    },
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: [],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {
        chrome: "49",
        firefox: "51.0.0",
        safari: "11",
      },
    },
    otherwise: {
      babelPluginRequiredNameArray: ["transform-block-scoping"],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// supporting any chrome + firefox + webkit
{
  const actual = generateGroupMap({
    babelPluginMap: {
      "transform-block-scoping": true,
      "transform-modules-systemjs": true,
    },
    runtimeSupport: {
      chrome: "0.0.0",
      firefox: "0.0.0",
      safari: "0.0.0",
    },
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: [
        "transform-block-scoping",
        "transform-modules-systemjs",
      ],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {
        chrome: "0.0.0",
        firefox: "0.0.0",
        safari: "0.0.0",
      },
    },
    otherwise: {
      babelPluginRequiredNameArray: [
        "transform-block-scoping",
        "transform-modules-systemjs",
      ],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// close to reality (supporting recent runtimes and all jsenv babel plugins enabled)
{
  const actual = generateGroupMap({
    babelPluginMap: jsenvBabelPluginMap,
    runtimeSupport: {
      chrome: "67.0.0",
      firefox: "59.0.0",
      safari: "13.0.0",
      node: "14.0.0",
    },
  })
  const expected = {
    best: {
      babelPluginRequiredNameArray: [
        "proposal-numeric-separator",
        "proposal-optional-chaining",
        "proposal-json-strings",
        "proposal-unicode-property-regex",
        "transform-dotall-regex",
      ],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {
        chrome: "38",
        firefox: "3",
        safari: "7.1",
        node: "0.12",
      },
    },
    otherwise: {
      babelPluginRequiredNameArray: [
        "proposal-numeric-separator",
        "proposal-json-strings",
        "proposal-object-rest-spread",
        "proposal-optional-catch-binding",
        "proposal-optional-chaining",
        "proposal-unicode-property-regex",
        "transform-async-to-promises",
        "transform-arrow-functions",
        "transform-block-scoped-functions",
        "transform-block-scoping",
        "transform-classes",
        "transform-computed-properties",
        "transform-destructuring",
        "transform-dotall-regex",
        "transform-duplicate-keys",
        "transform-exponentiation-operator",
        "transform-for-of",
        "transform-function-name",
        "transform-literals",
        "transform-new-target",
        "transform-object-super",
        "transform-parameters",
        "transform-regenerator",
        "transform-shorthand-properties",
        "transform-spread",
        "transform-sticky-regex",
        "transform-template-literals",
        "transform-typeof-symbol",
        "transform-unicode-regex",
      ],
      jsenvPluginRequiredNameArray: [],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}
