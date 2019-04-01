// we could reuse this to get a list of polyfill
// using https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/built-ins.json#L1
// adding a featureNameArray to every group
// and according to that featureNameArray, add these polyfill
// to the generated bundle

import { arrayWithoutValue } from "@dmail/helper"
import { babelPluginCompatibilityDescription as defaultBabelPluginCompatibilityDescription } from "./babelPluginCompatibilityDescription.js"
import { compatibilityToScore } from "./compatibility/compatibilityToScore.js"
import { computeEveryPlatformGroupArray } from "./compatibility-description/computeEveryPlatformGroupArray.js"

const BEST_ID = "best"
const OTHERWISE_ID = "otherwise"

export const generateGroupDescription = ({
  babelPluginDescription,
  platformScoring,
  groupCount = 1,
  babelPluginCompatibilityDescription = defaultBabelPluginCompatibilityDescription,
}) => {
  const groupDescription = generateGenericGroupDescription({
    featureDescription: babelPluginDescription,
    compatibilityDescription: babelPluginCompatibilityDescription,
    platformScoring,
    groupCount,
  })

  const babelGroupDescription = {}
  Object.keys(groupDescription).forEach((groupName) => {
    const { incompatibleNameArray, compatibility } = groupDescription[groupName]
    babelGroupDescription[groupName] = {
      babelPluginNameArray: incompatibleNameArray,
      compatibility,
    }
  })
  return babelGroupDescription
}

const generateGenericGroupDescription = ({
  featureDescription,
  compatibilityDescription,
  platformScoring,
  groupCount,
}) => {
  if (typeof featureDescription !== "object")
    throw new TypeError(`featureDescription must be an object, got ${featureDescription}`)
  if (typeof compatibilityDescription !== "object")
    throw new TypeError(
      `compatibilityDescription must be an object, got ${compatibilityDescription}`,
    )
  if (typeof platformScoring !== "object")
    throw new TypeError(`platformScoring must be an object, got ${platformScoring}`)
  if (typeof groupCount < 1) throw new TypeError(`groupCount must be above 1, got ${groupCount}`)

  const featureNameArray = Object.keys(featureDescription)

  const groupWithoutFeature = {
    incompatibleNameArray: featureNameArray,
    compatibility: {},
  }

  if (groupCount === 1) {
    return {
      [OTHERWISE_ID]: groupWithoutFeature,
    }
  }

  const specificCompatibilityDescription = {}
  featureNameArray.forEach((featureName) => {
    specificCompatibilityDescription[featureName] =
      featureName in specificCompatibilityDescription
        ? specificCompatibilityDescription[featureName]
        : {}
  })

  const groupArrayWithEveryCombination = computeEveryPlatformGroupArray({
    compatibilityDescription: specificCompatibilityDescription,
    platformNames: arrayWithoutValue(Object.keys(platformScoring), "other"),
  })

  if (groupArrayWithEveryCombination.length === 0) {
    return {
      [OTHERWISE_ID]: groupWithoutFeature,
    }
  }

  const groupToScore = ({ compatibility }) => compatibilityToScore(compatibility, platformScoring)
  const groupArrayWithEveryCombinationSortedByPlatformScore = groupArrayWithEveryCombination.sort(
    (a, b) => groupToScore(b) - groupToScore(a),
  )

  const length = groupArrayWithEveryCombinationSortedByPlatformScore.length
  const groupArray =
    length + 1 > groupCount
      ? groupArrayWithEveryCombinationSortedByPlatformScore.slice(0, groupCount - 1)
      : groupArrayWithEveryCombinationSortedByPlatformScore

  const groupDescription = {}
  groupArray.forEach((group, index) => {
    if (index === 0) {
      groupDescription[BEST_ID] = group
    } else {
      groupDescription[`intermediate-${index + 1}`] = group
    }
  })
  groupDescription[OTHERWISE_ID] = groupWithoutFeature
  return groupDescription
}
