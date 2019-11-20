/*

# featureCompatMap legend

        featureName
             │
{ ┌──────────┴────────────┐
  "transform-block-scoping": {─┐
    "chrome": "10",            │
    "safari": "3.0",           platformCompatMap
    "firefox": "5.1"           │
}────┼─────────┼─────────────┘
}      │         └─────┐
  platformName  platformVersion

# group legend

{
  "best": {
    "babelPluginRequiredNameArray" : [
      "transform-block-scoping",
    ],
    "platformCompatMap": {
      "chrome": "10",
      "firefox": "6"
    }
  }
}

Take chars below to update legends
─│┌┐└┘├┤┴┬

*/

import { COMPILE_ID_OTHERWISE, COMPILE_ID_BEST } from "internal/CONSTANTS.js"
import { generateAllPlatformGroupArray } from "./generateAllPlatformGroupArray.js"
import { platformCompatMapToScore } from "./platformCompatMapToScore.js"

export const generateGroupMap = ({
  babelPluginMap,
  // jsenv plugin are for later, for now, nothing is using them
  jsenvPluginMap = {},
  babelPluginCompatMap,
  jsenvPluginCompatMap,
  platformScoreMap,
  groupCount = 1,
  // pass this to true if you don't care if someone tries to run your code
  // on a platform which is not inside platformScoreMap.
  platformAlwaysInsidePlatformScoreMap = false,
  // pass this to true if you think you will always be able to detect
  // the platform or that if you fail to do so you don't care.
  platformWillAlwaysBeKnown = false,
}) => {
  if (typeof babelPluginMap !== "object") {
    throw new TypeError(`babelPluginMap must be an object, got ${babelPluginMap}`)
  }
  if (typeof jsenvPluginMap !== "object") {
    throw new TypeError(`jsenvPluginMap must be an object, got ${jsenvPluginMap}`)
  }
  if (typeof platformScoreMap !== "object") {
    throw new TypeError(`platformScoreMap must be an object, got ${platformScoreMap}`)
  }
  if (typeof groupCount < 1) {
    throw new TypeError(`groupCount must be above 1, got ${groupCount}`)
  }

  const groupWithoutFeature = {
    babelPluginRequiredNameArray: Object.keys(babelPluginMap),
    jsenvPluginRequiredNameArray: Object.keys(jsenvPluginMap),
    platformCompatMap: {},
  }

  // when we create one group and we cannot ensure
  // code will be runned on a platform inside platformScoreMap
  // then we return otherwise group to be safe
  if (groupCount === 1 && !platformAlwaysInsidePlatformScoreMap) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
    }
  }

  const allPlatformGroupArray = generateAllPlatformGroupArray({
    babelPluginMap,
    babelPluginCompatMap,
    jsenvPluginMap,
    jsenvPluginCompatMap,
    platformNames: arrayWithoutValue(Object.keys(platformScoreMap), "other"),
  })

  if (allPlatformGroupArray.length === 0) {
    return {
      [COMPILE_ID_OTHERWISE]: groupWithoutFeature,
    }
  }

  const groupToScore = ({ platformCompatMap }) =>
    platformCompatMapToScore(platformCompatMap, platformScoreMap)

  const allPlatformGroupArraySortedByScore = allPlatformGroupArray.sort(
    (a, b) => groupToScore(b) - groupToScore(a),
  )

  const length = allPlatformGroupArraySortedByScore.length

  // if we arrive here and want a single group
  // we take the worst group and consider it's our best group
  // because it's the lowest platform we want to support
  if (groupCount === 1) {
    return {
      [COMPILE_ID_BEST]: allPlatformGroupArraySortedByScore[length - 1],
    }
  }

  const addOtherwiseToBeSafe = !platformAlwaysInsidePlatformScoreMap || !platformWillAlwaysBeKnown

  const lastGroupIndex = addOtherwiseToBeSafe ? groupCount - 1 : groupCount

  const groupArray =
    length + 1 > groupCount
      ? allPlatformGroupArraySortedByScore.slice(0, lastGroupIndex)
      : allPlatformGroupArraySortedByScore

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
