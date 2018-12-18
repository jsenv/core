import { compatMapCompose } from "../compatMapCompose.js"

const platformGroupReducer = (previous, platformGroup) => {
  const groups = []

  previous.forEach((firstPlatformGroup) => {
    groups.push({
      pluginNames: firstPlatformGroup.pluginNames.slice(),
      compatMap: { ...firstPlatformGroup.compatMap },
    })
  })

  platformGroup.forEach((secondPlatformGroup) => {
    const pluginNames = secondPlatformGroup.pluginNames
    const existingGroup = groups.find((platformGroup) => {
      return pluginNames.join("") === platformGroup.pluginNames.join("")
    })
    if (existingGroup) {
      existingGroup.compatMap = compatMapCompose(
        existingGroup.compatMap,
        secondPlatformGroup.compatMap,
      )
    } else {
      groups.push({
        pluginNames: pluginNames.slice(),
        compatMap: { ...secondPlatformGroup.compatMap },
      })
    }
  })

  return groups
}

export const platformGroupsCompose = (...platformGroups) => {
  return platformGroups.reduce(platformGroupReducer, [])
}
