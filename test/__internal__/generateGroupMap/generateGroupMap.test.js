import { assert } from "@jsenv/assert"

import { generateGroupMap } from "@jsenv/core/src/internal/generateGroupMap/generateGroupMap.js"
import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"
import { jsenvBabelPluginMap } from "@jsenv/core/test/jsenvBabelPluginMap.js"

// supporting all node versions ("0.0.0")
{
  const actual = generateGroupMap({
    featureNames: ["transform-block-scoping"],
    runtimeSupport: {
      node: "0.0.0",
    },
  })
  const expected = {
    best: {
      missingFeatureNames: ["transform-block-scoping"],
      minRuntimeVersions: {
        node: "0.0.0",
      },
    },
    otherwise: {
      missingFeatureNames: ["transform-block-scoping"],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// supporting node 14.17
{
  const actual = generateGroupMap({
    featureNames: ["transform-block-scoping"],
    runtimeSupport: {
      node: "14.17",
    },
  })
  const expected = {
    best: {
      missingFeatureNames: [],
      minRuntimeVersions: { node: "6" },
    },
    otherwise: {
      missingFeatureNames: ["transform-block-scoping"],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// supporting chrome and firefox
{
  const actual = generateGroupMap({
    featureNames: ["transform-block-scoping", "transform-modules-systemjs"],
    runtimeSupport: {
      chrome: "60",
      firefox: "51",
    },
  })
  const expected = {
    best: {
      missingFeatureNames: ["transform-modules-systemjs"],
      minRuntimeVersions: {
        chrome: "49",
        firefox: "51",
      },
    },
    otherwise: {
      missingFeatureNames: [
        "transform-block-scoping",
        "transform-modules-systemjs",
      ],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// supporting chrome + firefox + webkit
{
  const actual = generateGroupMap({
    featureNames: ["transform-block-scoping"],
    runtimeSupport: {
      chrome: "49",
      firefox: "51.0.0",
      safari: "12.0.0",
    },
  })
  const expected = {
    best: {
      missingFeatureNames: [],
      minRuntimeVersions: {
        chrome: "49",
        firefox: "51",
        safari: "11",
      },
    },
    otherwise: {
      missingFeatureNames: ["transform-block-scoping"],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// supporting any chrome + firefox + webkit
{
  const actual = generateGroupMap({
    featureNames: ["transform-block-scoping", "transform-modules-systemjs"],
    runtimeSupport: {
      chrome: "0.0.0",
      firefox: "0.0.0",
      safari: "0.0.0",
    },
  })
  const expected = {
    best: {
      missingFeatureNames: [
        "transform-block-scoping",
        "transform-modules-systemjs",
      ],
      minRuntimeVersions: {
        chrome: "0.0.0",
        firefox: "0.0.0",
        safari: "0.0.0",
      },
    },
    otherwise: {
      missingFeatureNames: [
        "transform-block-scoping",
        "transform-modules-systemjs",
      ],
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// close to reality (supporting recent runtimes and all jsenv babel plugins enabled)
{
  const actual = generateGroupMap({
    featureNames: Object.keys(jsenvBabelPluginMap),
    runtimeSupport: {
      chrome: "67.0.0",
      firefox: "59.0.0",
      safari: "13.0.0",
      node: "14.0.0",
    },
  })
  const expected = {
    best: {
      missingFeatureNames: [
        "proposal-numeric-separator",
        "proposal-optional-chaining",
        "proposal-json-strings",
        "proposal-unicode-property-regex",
        "transform-dotall-regex",
      ],
      minRuntimeVersions: {
        chrome: "66",
        firefox: "58",
        safari: "13",
        node: "14",
      },
    },
    otherwise: {
      missingFeatureNames: [
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
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}

// during dev
{
  const actual = generateGroupMap({
    featureNames: Object.keys(jsenvBabelPluginMap),
    runtimeSupport: jsenvRuntimeSupportDuringDev,
  })
  const expected = {
    best: {
      missingFeatureNames: [],
      minRuntimeVersions: {
        chrome: "80",
        firefox: "78",
        safari: "13.1",
        node: "14",
      },
    },
    otherwise: {
      missingFeatureNames: [
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
      minRuntimeVersions: {},
    },
  }
  assert({ actual, expected })
}
