// https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/plugins.json
import { compatMap as defaultCompatMap } from "@dmail/project-structure-compile-babel"

import { createPlatformGroups } from "./createPlatformGroups.js"
import { composePlatformGroups } from "./composePlatformGroups.js"
import { createPluginNamesToScore } from "./createPluginNamesToScore.js"
import { splitGroups } from "./splitGroups.js"
import { createCompatMapToScore } from "./createCompatMapToScore.js"
import { statMapGeneric } from "./statMapGeneric.js"

const PLATFORM_NAMES = ["chrome", "edge", "firefox", "safari", "node", "ios", "opera", "electron"]

const createGroupsForPlatforms = (compatMap, platformNames) => {
  const platformGroups = platformNames.map((platformName) =>
    createPlatformGroups(compatMap, platformName),
  )
  const groups = composePlatformGroups(...platformGroups)
  return groups
}

const sortGroupByComplexity = (groups) => {
  const pluginNamesToScore = createPluginNamesToScore()
  const sortedGroups = groups.sort(
    (a, b) => pluginNamesToScore(a.pluginNames) - pluginNamesToScore(b.pluginNames),
  )
  return sortedGroups
}

export const compileProfiles = (
  {
    pluginNames = [],
    platformNames = PLATFORM_NAMES,
    size = 4,
    stats = statMapGeneric,
    compatMap = defaultCompatMap,
  } = {},
) => {
  const compatMapFiltered = {}
  pluginNames.forEach((pluginName) => {
    compatMapFiltered[pluginName] = pluginName in compatMap ? compatMap[pluginName] : {}
  })

  const groupsForPlatforms = createGroupsForPlatforms(compatMapFiltered, platformNames)
  const compatMapToScore = createCompatMapToScore(stats)
  const groupsForPlatformsSubset = splitGroups(
    groupsForPlatforms,
    ({ compatMap }) => compatMapToScore(compatMap),
    size,
  )
  const sortedGroups = sortGroupByComplexity(groupsForPlatformsSubset)

  const groupWithEverything = {
    pluginNames: Object.keys(compatMapFiltered),
    compatMap: {},
  }

  const profiles = sortedGroups
  const fallback = groupWithEverything

  return { profiles, fallback }
}
