// https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/plugins.json
import { babelPluginCompatibilityDescription as defaultBabelPluginCompatibilityDescription } from "./babelPluginCompatibilityDescription.js"
import { compatibilityDescriptionToGroupArray } from "./compatibilityDescriptionToGroupArray/index.js"
import { compatibilityDescriptionToScore } from "./compatibilityDescriptionToScore.js"
import { decreaseArrayByComposingValues } from "../../decreaseArrayByComposingValues.js"
import { babelPluginNameArrayToScore } from "./babelPluginNameArrayToScore.js"
import { groupCompose } from "./groupCompose.js"

const BEST_ID = "best"
const OTHERWISE_ID = "otherwise"

// rename envDescriptionm this is strange
// maybe compileMap too
// group naming is too generic as well but couldn't find a better name for now
export const envDescriptionToCompileMap = ({
  compileGroupCount = 4,
  babelPluginNameArray = [],
  babelPluginCompatibilityDescription = defaultBabelPluginCompatibilityDescription,
  platformScoring,
} = {}) => {
  const groupWithEverything = {
    babelPluginNameArray: babelPluginNameArray.sort(),
    compatibility: {},
  }

  if (compileGroupCount === 1) {
    return {
      [OTHERWISE_ID]: groupWithEverything,
    }
  }

  const specificBabelPluginCompatibilityDescription = {}
  babelPluginNameArray.forEach((babelPluginName) => {
    specificBabelPluginCompatibilityDescription[babelPluginName] =
      babelPluginName in babelPluginCompatibilityDescription
        ? babelPluginCompatibilityDescription[babelPluginName]
        : {}
  })

  const groupArrayWithEveryCombination = compatibilityDescriptionToGroupArray({
    compatibilityDescription: specificBabelPluginCompatibilityDescription,
  })

  const groupToScore = ({ compatibilityDescription }) =>
    compatibilityDescriptionToScore(compatibilityDescription, platformScoring)
  const groupArrayWithEveryCombinationSortedByPlatformScore = groupArrayWithEveryCombination.sort(
    (a, b) => groupToScore(b) - groupToScore(a),
  )

  const groupArrayDecreased = decreaseArrayByComposingValues({
    array: groupArrayWithEveryCombinationSortedByPlatformScore,
    length: compileGroupCount,
    composer: groupCompose,
  })

  const groupToComplexityScore = ({ babelPluginNameArray }) =>
    babelPluginNameArrayToScore(babelPluginNameArray)
  const groupArrayDecreasedSortedByCompexityScore = groupArrayDecreased.sort(
    (a, b) => groupToComplexityScore(a) - groupToComplexityScore(b),
  )

  // replace last group with the everything group
  const length = groupArrayDecreasedSortedByCompexityScore.length
  groupArrayDecreasedSortedByCompexityScore[length - 1] = groupWithEverything

  const compileMap = {}

  compileMap[BEST_ID] = groupArrayDecreasedSortedByCompexityScore[0]
  groupArrayDecreasedSortedByCompexityScore
    .slice(1, -1)
    .forEach((intermediatePluginGroup, index) => {
      compileMap[`intermediate-${index + 1}`] = intermediatePluginGroup
    })
  compileMap[OTHERWISE_ID] = groupArrayDecreasedSortedByCompexityScore[length - 1]

  return compileMap
}
