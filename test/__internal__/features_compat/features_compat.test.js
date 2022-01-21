import { assert } from "@jsenv/assert"

import { featuresCompatFromRuntimeSupport } from "@jsenv/core/src/internal/compiling/out_directory/features_compat_from_runtime_support.js"
import { jsenvRuntimeSupportDuringDev } from "@jsenv/core/src/jsenvRuntimeSupportDuringDev.js"
import { jsenvBabelPluginMap } from "@jsenv/core/test/jsenvBabelPluginMap.js"

// supporting all node versions ("0.0.0")
{
  const actual = featuresCompatFromRuntimeSupport({
    featureNames: ["transform-block-scoping"],
    runtimeSupport: {
      node: "0.0.0",
    },
  })
  const expected = {
    availableFeatureNames: [],
    minRuntimeVersions: {
      node: "0.0.0",
    },
  }
  assert({ actual, expected })
}

// supporting node 14.17
{
  const actual = featuresCompatFromRuntimeSupport({
    featureNames: ["transform-block-scoping"],
    runtimeSupport: {
      node: "14.17",
    },
  })
  const expected = {
    availableFeatureNames: ["transform-block-scoping"],
    minRuntimeVersions: {
      node: "6",
    },
  }
  assert({ actual, expected })
}

// supporting chrome and firefox
{
  const actual = featuresCompatFromRuntimeSupport({
    featureNames: ["transform-block-scoping", "transform-modules-systemjs"],
    runtimeSupport: {
      chrome: "60",
      firefox: "51",
    },
  })
  const expected = {
    availableFeatureNames: ["transform-block-scoping"],
    minRuntimeVersions: {
      chrome: "49",
      firefox: "51",
    },
  }
  assert({ actual, expected })
}

// supporting chrome + firefox + webkit
{
  const actual = featuresCompatFromRuntimeSupport({
    featureNames: ["transform-block-scoping"],
    runtimeSupport: {
      chrome: "49",
      firefox: "51.0.0",
      safari: "12.0.0",
    },
  })
  const expected = {
    availableFeatureNames: ["transform-block-scoping"],
    minRuntimeVersions: {
      chrome: "49",
      firefox: "51",
      safari: "11",
    },
  }
  assert({ actual, expected })
}

// supporting any chrome + firefox + webkit
{
  const actual = featuresCompatFromRuntimeSupport({
    featureNames: ["transform-block-scoping", "transform-modules-systemjs"],
    runtimeSupport: {
      chrome: "0.0.0",
      firefox: "0.0.0",
      safari: "0.0.0",
    },
  })
  const expected = {
    availableFeatureNames: [],
    minRuntimeVersions: {
      chrome: "0.0.0",
      firefox: "0.0.0",
      safari: "0.0.0",
    },
  }
  assert({ actual, expected })
}

// close to reality (supporting recent runtimes and all jsenv babel plugins enabled)
{
  const actual = featuresCompatFromRuntimeSupport({
    featureNames: Object.keys(jsenvBabelPluginMap),
    runtimeSupport: {
      chrome: "67.0.0",
      firefox: "59.0.0",
      safari: "13.0.0",
      node: "14.0.0",
    },
  })
  const expected = {
    availableFeatureNames: [
      "proposal-json-strings",
      "proposal-object-rest-spread",
      "proposal-optional-catch-binding",
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
      "proposal-numeric-separator",
      "proposal-optional-chaining",
    ],
    minRuntimeVersions: {
      chrome: "66",
      firefox: "58",
      safari: "13",
      node: "14",
    },
  }
  assert({ actual, expected })
}

// during dev
{
  const actual = featuresCompatFromRuntimeSupport({
    featureNames: Object.keys(jsenvBabelPluginMap),
    runtimeSupport: jsenvRuntimeSupportDuringDev,
  })
  const expected = {
    availableFeatureNames: [
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
    minRuntimeVersions: {
      chrome: "80",
      firefox: "78",
      safari: "13.1",
      node: "14",
    },
  }
  assert({ actual, expected })
}
