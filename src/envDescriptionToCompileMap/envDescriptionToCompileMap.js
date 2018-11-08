// https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/plugins.json
import { compatMap as pluginCompatMapDefault } from "@dmail/project-structure-compile-babel"

import { pluginCompatMapToCompileGroups } from "./pluginCompatMapToCompileGroups/index.js"
import { compatMapToUsageScore } from "./compatMapToUsageScore.js"
import { platformUsageMapDefault } from "./platformUsageMapDefault.js"
import { compileGroupsRegroupIn } from "./compileGroupsRegroupIn/compileGroupsRegroupIn.js"
import { pluginNamesToScore } from "./pluginNamesToScore.js"

const BEST_ID = "best"
const WORST_ID = "worst"
export const DEFAULT_ID = "otherwise"

export const envDescriptionToCompileMap = (
  {
    pluginNames = [],
    platformUsageMap = platformUsageMapDefault,
    pluginCompatMap = pluginCompatMapDefault,
  } = {},
  { size = 4 } = {},
) => {
  const pluginCompatMapFiltered = {}
  pluginNames.forEach((pluginName) => {
    pluginCompatMapFiltered[pluginName] =
      pluginName in pluginCompatMap ? pluginCompatMap[pluginName] : {}
  })

  const pluginGroupToUsageScore = ({ compatMap }) =>
    compatMapToUsageScore(compatMap, platformUsageMap)
  const allCompileGroups = pluginCompatMapToCompileGroups(pluginCompatMapFiltered).sort(
    (a, b) => pluginGroupToUsageScore(b) - pluginGroupToUsageScore(a),
  )

  const compileGroupToComplexityScore = ({ pluginNames }) => pluginNamesToScore(pluginNames)
  const compileGroups = compileGroupsRegroupIn(allCompileGroups, size).sort(
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
  compileMap[WORST_ID] = compileGroups[compileGroups.length - 1]
  compileMap[DEFAULT_ID] = groupWithEverything

  return compileMap
}
