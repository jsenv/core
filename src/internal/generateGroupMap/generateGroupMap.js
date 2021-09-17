/*

# featureCompatMap legend

        featureName
             │
{ ┌──────────┴────────────┐
  "transform-block-scoping": {─┐
    "chrome": "10",            │
    "safari": "3.0",           runTimeCompatMap
    "firefox": "5.1"           │
}────┼─────────┼───────────────┘
}    │         └─────┐
  runtimeName  runtimeVersion

# group legend

{
  "best": {
    "babelPluginRequiredNameArray" : [
      "transform-block-scoping",
    ],
    "runtimeCompatMap": {
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
import { jsenvRuntimeScoreMap } from "./jsenvRuntimeScoreMap.js"
import { createRuntimeCompatForEveryRuntimeVersions } from "./runtime_compat/for_every_runtime_versions.js"
import { createRuntimeCompatForOneRuntimeVersion } from "./runtime_compat/for_one_runtime_version.js"
import { composeRuntimeCompat } from "./runtime_compat/runtime_compat_composition.js"
import { runtimeCompatMapToScore } from "./runtimeCompatMapToScore.js"

export const generateGroupMap = ({
  babelPluginMap,
  runtimeSupport,
  compileGroupCount = 1,
  babelPluginCompatMap = jsenvBabelPluginCompatMap,
  // pass this to true if you don't care if someone tries to run your code
  // on a runtime which is not inside runtimeSupport.
  runtimeSupportIsExhaustive = false,
  // pass this to true if you think you will always be able to detect
  // the runtime or that if you fail to do so you don't care.
  runtimeWillAlwaysBeKnown = false,
  runtimeScoreMap = jsenvRuntimeScoreMap,
  // jsenv plugin are for later, for now, nothing is using them
  jsenvPluginMap = {},
  jsenvPluginCompatMap,
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
  if (typeof compileGroupCount < 1) {
    throw new TypeError(
      `compileGroupCount must be above 1, got ${compileGroupCount}`,
    )
  }

  const runtimeNames = Object.keys(runtimeSupport)

  babelPluginMap = withoutSyntaxPlugins(babelPluginMap)
  const groupWithoutFeature = {
    babelPluginRequiredNameArray: Object.keys(babelPluginMap),
    jsenvPluginRequiredNameArray: Object.keys(jsenvPluginMap),
    runtimeCompatMap: {},
  }

  if (runtimeNames.length === 0) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
    }
  }

  if (compileGroupCount === 1) {
    if (!runtimeSupportIsExhaustive) {
      // when there is only 1 group and we cannot ensure
      // code is runned on a supported runtime,
      // we'll use otherwise group to be safe
      return {
        [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
      }
    }

    const runtimeCompats = createRuntimeCompatForOneRuntimeVersion({
      runtimeSupport,

      babelPluginMap,
      babelPluginCompatMap,

      jsenvPluginMap,
      jsenvPluginCompatMap,
    })
    const groupForRuntime = composeRuntimeCompat(...runtimeCompats)

    return {
      [COMPILE_ID_OTHERWISE]: groupForRuntime,
    }
  }

  const addOtherwiseToBeSafe =
    !runtimeSupportIsExhaustive || !runtimeWillAlwaysBeKnown
  if (compileGroupCount === 2 && addOtherwiseToBeSafe) {
    const runtimeCompats = createRuntimeCompatForOneRuntimeVersion({
      runtimeSupport,

      babelPluginMap,
      babelPluginCompatMap,

      jsenvPluginMap,
      jsenvPluginCompatMap,
    })
    const groupForRuntime = composeRuntimeCompat(...runtimeCompats)

    return {
      [COMPILE_ID_BEST]: groupForRuntime,
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
    }
  }

  const allGroups = createRuntimeCompatForEveryRuntimeVersions({
    runtimeSupport,

    babelPluginMap,
    babelPluginCompatMap,

    jsenvPluginMap,
    jsenvPluginCompatMap,
  })

  const groupToScore = ({ runtimeCompatMap }) =>
    runtimeCompatMapToScore(runtimeCompatMap, runtimeScoreMap)

  const groupsSortedByScore = allGroups.sort(
    (a, b) => groupToScore(b) - groupToScore(a),
  )

  const groups =
    groupsSortedByScore.length + 1 > compileGroupCount
      ? groupsSortedByScore.slice(0, compileGroupCount)
      : groupsSortedByScore
  const groupMap = createGroupMap(groups.slice(0, -1))

  if (addOtherwiseToBeSafe) {
    return {
      ...groupMap,
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
    }
  }

  return {
    ...groupMap,
    worst: groups[groups.length - 1],
  }
}

const createGroupMap = (groups) => {
  const groupMap = {}
  groups.forEach((group, index) => {
    if (index === 0) {
      groupMap[COMPILE_ID_BEST] = group
    } else {
      groupMap[`intermediate-${index}`] = group
    }
  })
  return groupMap
}

export const withoutSyntaxPlugins = (babelPluginMap) => {
  const babelPluginMapWithoutSyntaxPlugins = {}
  Object.keys(babelPluginMap).forEach((key) => {
    if (key.startsWith("syntax-")) {
      return
    }
    babelPluginMapWithoutSyntaxPlugins[key] = babelPluginMap[key]
  })
  return babelPluginMapWithoutSyntaxPlugins
}
