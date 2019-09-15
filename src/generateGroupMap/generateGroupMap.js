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
    "incompatibleNameArray" : [
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

import { babelCompatMap as defaultBabelCompatMap } from "../babelCompatMap/babelCompatMap.js"
import { polyfillCompatMap as defaulPolyfillCompatMap } from "../polyfillCompatMap/polyfillCompatMap.js"
import { generateAllPlatformGroupArray } from "./generateAllPlatformGroupArray.js"
import { platformCompatMapToScore } from "./platformCompatMapToScore.js"
import { OTHERWISE_ID, BEST_ID } from "../GROUP_ID.js"

export const generateGroupMap = ({
  babelPluginMap,
  babelCompatMap = defaultBabelCompatMap,
  // polyfill are for later, for now, nothing is using them
  polyfillConfigMap = {},
  polyfillCompatMap = defaulPolyfillCompatMap,
  platformScoreMap,
  groupCount = 1,
  // pass this to true if you don't care if someone tries to run your code
  // on a platform which is not inside platformScoreMap.
  platformAlwaysInsidePlatformScoreMap = false,
  // pass this to true if you think you will always be able to detect
  // the platform or that if you fail to do so you don't care.
  platformWillAlwaysBeKnown = false,
}) => {
  const groupMap = generateFeatureGroupMap({
    // here we should throw if key conflict between babelPluginMap/polyfillConfigMap
    featureConfigMap: { ...babelPluginMap, ...polyfillConfigMap },
    // here we should throw if key conflict on babelCompatMap/polyfillCompatMap
    featureCompatMap: {
      ...babelCompatMap,
      ...polyfillCompatMap,
    },
    platformScoreMap,
    groupCount,
    platformAlwaysInsidePlatformScoreMap,
    platformWillAlwaysBeKnown,
  })
  return groupMap
}

const generateFeatureGroupMap = ({
  featureConfigMap,
  featureCompatMap,
  platformScoreMap,
  groupCount,
  platformAlwaysInsidePlatformScoreMap,
  platformWillAlwaysBeKnown,
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
    platformCompatMap: {},
  }

  // when we create one group and we cannot ensure
  // code will be runned on a platform inside platformScoreMap
  // then we return otherwise group to be safe
  if (groupCount === 1 && !platformAlwaysInsidePlatformScoreMap) {
    return {
      [OTHERWISE_ID]: groupWithoutFeature,
    }
  }

  const featureCompatMapWithoutHole = {}
  featureNameArray.forEach((featureName) => {
    featureCompatMapWithoutHole[featureName] =
      featureName in featureCompatMap ? featureCompatMap[featureName] : {}
  })

  const allPlatformGroupArray = generateAllPlatformGroupArray({
    featureCompatMap: featureCompatMapWithoutHole,
    platformNames: arrayWithoutValue(Object.keys(platformScoreMap), "other"),
  })

  if (allPlatformGroupArray.length === 0) {
    return {
      [OTHERWISE_ID]: groupWithoutFeature,
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
      [BEST_ID]: allPlatformGroupArraySortedByScore[length - 1],
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
      groupMap[BEST_ID] = group
    } else {
      groupMap[`intermediate-${index + 1}`] = group
    }
  })
  if (addOtherwiseToBeSafe) {
    groupMap[OTHERWISE_ID] = groupWithoutFeature
  }
  return groupMap
}

const arrayWithoutValue = (array, value) =>
  array.filter((valueCandidate) => valueCandidate !== value)
