/*

# featureCompatMap legend

        featureName
             │
{ ┌──────────┴────────────┐
  "transform-block-scoping": {─┐
    "chrome": "10",            │
    "safari": "3.0",           minRuntimeVersions
    "firefox": "5.1"           │
}────┼─────────┼───────────────┘
}    │         └─────┐
  runtimeName  runtimeVersion

# group legend

{
  "best": {
    "missingFeatureNames" : [
      "transform-block-scoping",
    ],
    "minRuntimeVersions": {
      "chrome": "10",
      "firefox": "6"
    }
  }
}

Take chars below to update legends
─│┌┐└┘├┤┴┬

*/

import { COMPILE_ID_OTHERWISE, COMPILE_ID_BEST } from "../CONSTANTS.js"
import { createRuntimeCompat } from "./runtime_compat.js"

export const generateGroupMap = ({ featureNames, runtimeSupport }) => {
  if (!Array.isArray(featureNames)) {
    throw new TypeError(`featureNames must be an array, got ${featureNames}`)
  }
  if (typeof runtimeSupport !== "object") {
    throw new TypeError(
      `runtimeSupport must be an object, got ${runtimeSupport}`,
    )
  }
  const runtimeNames = Object.keys(runtimeSupport)
  const groupWithoutFeature = {
    missingFeatureNames: featureNames,
    minRuntimeVersions: {},
  }
  if (runtimeNames.length === 0) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
    }
  }
  const runtimeCompat = createRuntimeCompat({
    runtimeSupport,
    featureNames,
  })
  return {
    [COMPILE_ID_BEST]: runtimeCompat,
    [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
  }
}
