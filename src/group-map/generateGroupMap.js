// we could reuse this to get a list of polyfill
// using https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/built-ins.json#L1
// adding a featureNameArray to every group
// and according to that featureNameArray, add these polyfill
// to the generated bundle

/*

# featureCompatibility object naming

        featureName
             │
{ ┌──────────┴────────────┐
  "transform-block-scoping": {─┐
    "chrome": "10",            │
    "safari": "3.0",           ├─platformCompatibility
    "firefox": "5.1"           │
  }────┼─────────┼─────────────┘
}      │         └─────┐
  platformName  platformVersion

# group object naming

{
  "best": {
    "incompatibleNameArray" : [
      "transform-block-scoping",
    ],
    "platformCompatibility": {
      "chrome": "10",
      "firefox": "6"
    }
  }
}

Take chars below to update legends
─│┌┐└┘├┤┴┬

*/

import { arrayWithoutValue } from "@dmail/helper"
import { babelCompatMap as defaultBabelCompatMap } from "./babelCompatMap.js"
import { platformCompatibilityToScore } from "./platform-compatibility/platformCompatibilityToScore.js"
import { computeEveryPlatformGroupArray } from "./group/computeEveryPlatformGroupArray.js"

const BEST_ID = "best"
const OTHERWISE_ID = "otherwise"

export const generateGroupMap = ({
  babelConfigMap,
  babelCompatMap = defaultBabelCompatMap,
  // polyfill are for later, for now, nothing is using them
  polyfillConfigMap = {},
  polyfillCompatMap = {},
  platformScoreMap,
  groupCount = 1,
}) => {
  const groupMap = generateFeatureGroupMap({
    // here we should throw if key conflict between babelConfigMap/polyfillConfigMap
    featureConfigMap: { ...babelConfigMap, ...polyfillConfigMap },
    // here we should throw if key conflict on babelCompatMap/polyfillCompatMap
    featureCompatMap: {
      ...babelCompatMap,
      ...polyfillCompatMap,
    },
    platformScoreMap,
    groupCount,
  })
  return groupMap
}

const generateFeatureGroupMap = ({
  featureConfigMap,
  featureCompatMap,
  platformScoreMap,
  groupCount,
}) => {
  if (typeof featureConfigMap !== "object")
    throw new TypeError(`featureConfigMap must be an object, got ${featureConfigMap}`)
  if (typeof featureCompatMap !== "object")
    throw new TypeError(`featureCompatMap must be an object, got ${featureCompatMap}`)
  if (typeof platformScoreMap !== "object")
    throw new TypeError(`platformScoreMap must be an object, got ${platformScoreMap}`)
  if (typeof groupCount < 1) throw new TypeError(`groupCount must be above 1, got ${groupCount}`)

  const featureNameArray = Object.keys(featureConfigMap)

  const groupWithoutFeature = {
    incompatibleNameArray: featureNameArray,
    platformCompatibility: {},
  }

  if (groupCount === 1) {
    return {
      [OTHERWISE_ID]: groupWithoutFeature,
    }
  }

  const featureCompatibilityWithoutHole = {}
  featureNameArray.forEach((featureName) => {
    featureCompatibilityWithoutHole[featureName] =
      featureName in featureCompatibilityWithoutHole
        ? featureCompatibilityWithoutHole[featureName]
        : {}
  })

  const groupArrayWithEveryCombination = computeEveryPlatformGroupArray({
    featureCompatibility: featureCompatibilityWithoutHole,
    platformNames: arrayWithoutValue(Object.keys(platformScoreMap), "other"),
  })

  if (groupArrayWithEveryCombination.length === 0) {
    return {
      [OTHERWISE_ID]: groupWithoutFeature,
    }
  }

  const groupToScore = ({ platformCompatibility }) =>
    platformCompatibilityToScore(platformCompatibility, platformScoreMap)
  const groupArrayWithEveryCombinationSortedByPlatformScore = groupArrayWithEveryCombination.sort(
    (a, b) => groupToScore(b) - groupToScore(a),
  )

  const length = groupArrayWithEveryCombinationSortedByPlatformScore.length
  const groupArray =
    length + 1 > groupCount
      ? groupArrayWithEveryCombinationSortedByPlatformScore.slice(0, groupCount - 1)
      : groupArrayWithEveryCombinationSortedByPlatformScore

  const groupMap = {}
  groupArray.forEach((group, index) => {
    if (index === 0) {
      groupMap[BEST_ID] = group
    } else {
      groupMap[`intermediate-${index + 1}`] = group
    }
  })
  groupMap[OTHERWISE_ID] = groupWithoutFeature
  return groupMap
}
