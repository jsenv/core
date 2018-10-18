// https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/plugins.json
import {
  compatMapBabel,
  getCompatMapWithModule,
  getCompatMapSubset,
} from "@dmail/project-structure-compile-babel"

import { createPlatformGroups } from "./createPlatformGroups.js"
import { composePlatformGroups } from "./composePlatformGroups.js"
import { createGetScoreForGroupTranspilationComplexity } from "./createGetScoreForGroupTranspilationComplexity.js"
import { splitGroups } from "./splitGroups.js"
import { createGetScoreForGroupCompatMap } from "./createGetScoreForGroupCompatMap.js"
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
  const getScoreForGroupTranspilationComplexity = createGetScoreForGroupTranspilationComplexity()
  const sortedGroups = groups.sort(
    (a, b) =>
      getScoreForGroupTranspilationComplexity(a) - getScoreForGroupTranspilationComplexity(b),
  )
  return sortedGroups
}

export const compileProfiles = (
  {
    stats = statMapGeneric,
    compatMap = compatMapBabel,
    size = 4,
    platformNames = PLATFORM_NAMES,
    moduleOutput,
    pluginNames = Object.keys(compatMap),
  } = {},
) => {
  compatMap = getCompatMapSubset(compatMap, pluginNames)
  compatMap = getCompatMapWithModule(compatMap, moduleOutput)

  const groupsForPlatforms = createGroupsForPlatforms(compatMap, platformNames)
  const getScoreForGroupCompatMap = createGetScoreForGroupCompatMap(stats)
  const groupsForPlatformsSubset = splitGroups(
    groupsForPlatforms,
    ({ compatMap }) => getScoreForGroupCompatMap(compatMap),
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
