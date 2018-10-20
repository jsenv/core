// https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/plugins.json
import { compatMapBabel, compatMapWithOnly } from "@dmail/project-structure-compile-babel"

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
    stats = statMapGeneric,
    compatMap = compatMapBabel,
    size = 4,
    platformNames = PLATFORM_NAMES,
    pluginNames = Object.keys(compatMap),
  } = {},
) => {
  compatMap = compatMapWithOnly(compatMap, pluginNames)

  const groupsForPlatforms = createGroupsForPlatforms(compatMap, platformNames)
  const compatMapToScore = createCompatMapToScore(stats)
  const groupsForPlatformsSubset = splitGroups(
    groupsForPlatforms,
    ({ compatMap }) => compatMapToScore(compatMap),
    size,
  )
  const sortedGroups = sortGroupByComplexity(groupsForPlatformsSubset)

  const groupWithEverything = {
    pluginNames: Object.keys(compatMap),
    compatMap: {},
  }

  const profiles = sortedGroups
  const fallback = groupWithEverything

  return { profiles, fallback }
}
