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
    "pluginRequiredNameArray" : [
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
import { jsenvBabelPluginCompatMap } from "./jsenvBabelPluginCompatMap.js"
import { jsenvPluginCompatMap } from "./jsenvPluginCompatMap.js"
import { createRuntimeCompat } from "./runtime_compat.js"

export const generateGroupMap = ({
  babelPluginMap,
  runtimeSupport,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  // jsenv plugin are for later, for now, nothing is using them
  jsenvPluginMap = {},
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(
      `babelPluginMap must be an object, got ${babelPluginMap}`,
    )
  }
  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(
      `jsenvPluginMap must be an object, got ${jsenvPluginMap}`,
    )
  }
  if (typeof runtimeSupport !== "object") {
    throw new TypeError(
      `runtimeSupport must be an object, got ${runtimeSupport}`,
    )
  }

  const runtimeNames = Object.keys(runtimeSupport)

  const groupWithoutFeature = {
    pluginRequiredNameArray: [
      ...Object.keys(babelPluginMap),
      ...Object.keys(jsenvPluginMap),
    ],
    minRuntimeVersions: {},
  }
  if (runtimeNames.length === 0) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
    }
  }

  const runtimeCompat = createRuntimeCompat({
    runtimeSupport,
    pluginMap: {
      ...babelPluginMap,
      ...jsenvPluginMap,
    },
    pluginCompatMap: {
      ...babelPluginCompatMap,
      ...jsenvPluginCompatMap,
    },
  })

  return {
    [COMPILE_ID_BEST]: runtimeCompat,
    [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
  }
}
