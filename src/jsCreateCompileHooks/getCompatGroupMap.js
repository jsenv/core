import { compileProfiles } from "./createCompileProfiles/index.js"

const BEST_ID = "best"
const WORST_ID = "worst"
export const DEFAULT_ID = "otherwise"

export const getCompatGroupMap = ({ stats, size, platformNames, pluginNames, compatMap }) => {
  const { profiles, fallback } = compileProfiles({
    stats,
    size,
    platformNames,
    pluginNames,
    compatMap,
  })

  const compatGroupMap = {}

  compatGroupMap[BEST_ID] = profiles[0]
  profiles.slice(1, -1).forEach((intermediateProfile, index) => {
    compatGroupMap[`intermediate-${index + 1}`] = intermediateProfile
  })
  compatGroupMap[WORST_ID] = profiles[profiles.length - 1]
  compatGroupMap[DEFAULT_ID] = fallback

  return compatGroupMap
}
