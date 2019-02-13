// https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/plugins.json
import { compatMap as pluginCompatMapDefault } from "@dmail/project-structure-compile-babel"
import { pluginCompatMapToCompileGroups } from "./pluginCompatMapToCompileGroups/index.js"
import { compatMapToScore } from "./compatMapToScore.js"
import { compileGroupsRegroupIn } from "./compileGroupsRegroupIn/compileGroupsRegroupIn.js"
import { pluginNamesToScore } from "./pluginNamesToScore.js"

const BEST_ID = "best"
const WORST_ID = "worst"
export const DEFAULT_ID = "otherwise"

export const envDescriptionToCompileMap = ({
  compileGroupCount = 4,
  pluginNames = [],
  pluginCompatMap = pluginCompatMapDefault,
  platformScoring,
} = {}) => {
  const pluginCompatMapFiltered = {}
  pluginNames.forEach((pluginName) => {
    pluginCompatMapFiltered[pluginName] =
      pluginName in pluginCompatMap ? pluginCompatMap[pluginName] : {}
  })

  const pluginGroupToScore = ({ compatMap }) => compatMapToScore(compatMap, platformScoring)
  const allCompileGroups = pluginCompatMapToCompileGroups(pluginCompatMapFiltered).sort(
    (a, b) => pluginGroupToScore(b) - pluginGroupToScore(a),
  )

  const compileGroupToComplexityScore = ({ pluginNames }) => pluginNamesToScore(pluginNames)
  const compileGroups = compileGroupsRegroupIn(allCompileGroups, compileGroupCount).sort(
    (a, b) => compileGroupToComplexityScore(a) - compileGroupToComplexityScore(b),
  )

  const groupWithEverything = {
    pluginNames: pluginNames.sort(),
    compatMap: {},
  }

  const compileMap = {}

  compileMap[BEST_ID] = compileGroups[0]
  compileGroups.slice(1, -1).forEach((intermediatePluginGroup, index) => {
    compileMap[`intermediate-${index + 1}`] = intermediatePluginGroup
  })
  if (compileGroups.length > 1) {
    compileMap[WORST_ID] = compileGroups[compileGroups.length - 1]
  }
  compileMap[DEFAULT_ID] = groupWithEverything

  return compileMap
}
