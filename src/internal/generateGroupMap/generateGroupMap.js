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
import { generateAllRuntimeGroupArray } from "./generateAllRuntimeGroupArray.js"
import { runtimeCompatMapToScore } from "./runtimeCompatMapToScore.js"

export const generateGroupMap = ({
  babelPluginMap,
  // jsenv plugin are for later, for now, nothing is using them
  jsenvPluginMap = {},
  babelPluginCompatMap,
  jsenvPluginCompatMap,
  runtimeScoreMap,
  groupCount = 1,
  // pass this to true if you don't care if someone tries to run your code
  // on a runtime which is not inside runtimeScoreMap.
  runtimeAlwaysInsideRuntimeScoreMap = false,
  // pass this to true if you think you will always be able to detect
  // the runtime or that if you fail to do so you don't care.
  runtimeWillAlwaysBeKnown = false,
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`)
  }
  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(`jsenvPluginMap must be an object, got ${jsenvPluginMap}`)
  }
  if (typeof runtimeScoreMap !== "object") {
    throw new TypeError(`runtimeScoreMap must be an object, got ${runtimeScoreMap}`)
  }
  if (typeof groupCount < 1) {
    throw new TypeError(`groupCount must be above 1, got ${groupCount}`)
  }

  const groupWithoutFeature = {
    babelPluginRequiredNameArray: Object.keys(babelPluginMap),
    jsenvPluginRequiredNameArray: Object.keys(jsenvPluginMap),
    runtimeCompatMap: {},
  }

  // when we create one group and we cannot ensure
  // code will be runned on a runtime inside runtimeScoreMap
  // then we return otherwise group to be safe
  if (groupCount === 1 && !runtimeAlwaysInsideRuntimeScoreMap) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
    }
  }

  const allRuntimeGroupArray = generateAllRuntimeGroupArray({
    babelPluginMap,
    babelPluginCompatMap,
    jsenvPluginMap,
    jsenvPluginCompatMap,
    runtimeNames: arrayWithoutValue(Object.keys(runtimeScoreMap), "other"),
  })

  if (allRuntimeGroupArray.length === 0) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
    }
  }

  const groupToScore = ({ runtimeCompatMap }) =>
    runtimeCompatMapToScore(runtimeCompatMap, runtimeScoreMap)

  const allRuntimeGroupArraySortedByScore = allRuntimeGroupArray.sort(
    (a, b) => groupToScore(b) - groupToScore(a),
  )

  const length = allRuntimeGroupArraySortedByScore.length

  // if we arrive here and want a single group
  // we take the worst group and consider it's our best group
  // because it's the lowest runtime we want to support
  if (groupCount === 1) {
    return {
      [COMPILE_ID_BEST]: allRuntimeGroupArraySortedByScore[length - 1],
    }
  }

  const addOtherwiseToBeSafe = !runtimeAlwaysInsideRuntimeScoreMap || !runtimeWillAlwaysBeKnown

  const lastGroupIndex = addOtherwiseToBeSafe ? groupCount - 1 : groupCount

  const groupArray =
    length + 1 > groupCount
      ? allRuntimeGroupArraySortedByScore.slice(0, lastGroupIndex)
      : allRuntimeGroupArraySortedByScore

  const groupMap = {}
  groupArray.forEach((group, index) => {
    if (index === 0) {
      groupMap[COMPILE_ID_BEST] = group
    } else {
      groupMap[`intermediate-${index + 1}`] = group
    }
  })
  if (addOtherwiseToBeSafe) {
    groupMap[COMPILE_ID_OTHERWISE] = groupWithoutFeature
  }

  return groupMap
}

const arrayWithoutValue = (array, value) =>
  array.filter((valueCandidate) => valueCandidate !== value)
