import { compileProfiles } from "./createCompileProfiles/index.js"

const BEST_ID = "best"
const WORST_ID = "worst"
export const DEFAULT_ID = "otherwise"

export const getGroupMap = ({ stats, size, platformNames, pluginNames, compatMap }) => {
  const { profiles, fallback } = compileProfiles({
    stats,
    size,
    platformNames,
    pluginNames,
    compatMap,
  })

  const groupMap = {}

  groupMap[BEST_ID] = profiles[0]
  profiles.slice(1, -1).forEach((intermediateProfile, index) => {
    groupMap[`intermediate-${index + 1}`] = intermediateProfile
  })
  groupMap[WORST_ID] = profiles[profiles.length - 1]
  groupMap[DEFAULT_ID] = fallback

  return groupMap
}
